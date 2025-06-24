import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { AIMessage, AIMessageChunk, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { concat } from "@langchain/core/utils/stream";
import { TavilySearch } from "@langchain/tavily";

export const createLangChainApp = async (modelApiKey: string, topic?: string) => {
    const model = new ChatGoogleGenerativeAI({
        apiKey: modelApiKey,
        model: 'gemini-1.5-flash',
        temperature: 0,
    });

    const searchTool = new DynamicStructuredTool({
        name: "search",
        description:
            "Use to surf the web, fetch current information, check the weather, and retrieve other information.",
        schema: z.object({
            query: z.string().describe("The query to use in your search."),
        }),
        func: async ({ query }: { query: string }) => {
            const tavily = new TavilySearch();
            try {
                const result = await tavily.invoke({ query });
                return result;
            } catch (error) {
                console.error("Error calling Tavily Search:", error);
                return "Failed to retrieve information from the web.";
            }
        },
    });

    await searchTool.invoke({ query: "What's the weather like?" });

    const tools = [searchTool];

    const toolNode = new ToolNode(tools);

    const boundModel = model.bindTools(tools);

    const AgentState = Annotation.Root({
        messages: Annotation<BaseMessage[]>({
            reducer: (x, y) => x.concat(y),
        }),
    });

    const shouldContinue = (state: typeof AgentState.State) => {
        const { messages } = state;
        const lastMessage = messages[messages.length - 1] as AIMessage;
        if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
            return "end";
        }
        return "continue";
    };

    const callModel = async (
        state: typeof AgentState.State,
        config?: RunnableConfig,
    ) => {
        const { messages } = state;
        let response: AIMessageChunk | undefined;
        for await (const message of await boundModel.stream(messages, config)) {
            if (!response) {
                response = message;
            } else {
                response = concat(response, message);
            }
        }
        return {
            messages: response ? [response as AIMessage] : [],
        };
    };

    const firstModel = async (state: typeof AgentState.State) => {
        // Extract content from the last message (which is expected to be a HumanMessage from user input)
        const lastHumanMessageContent = state.messages[state.messages.length - 1].content;
        let humanInputString: string = "";

        if (typeof lastHumanMessageContent === 'string') {
            humanInputString = lastHumanMessageContent;
        } else if (Array.isArray(lastHumanMessageContent)) {
            // If content is an array, concatenate text parts.
            humanInputString = lastHumanMessageContent
                .map(part => {
                    if (typeof part === 'object' && 'text' in part) {
                        return part.text;
                    }
                    return '';
                })
                .join('');
        }

        let messagesForModel: BaseMessage[] = [];

        if (topic) {
            const systemPrompt = new SystemMessage(
                `You are an expert in ${topic}. Your primary goal is to answer questions related to ${topic}. ` +
                `If a question is clearly outside the domain of ${topic}, you must politely decline to answer or redirect the user back to your area of expertise. ` +
                `Do not answer questions that are off-topic. Only use the 'search' tool for information directly related to ${topic}.`
            );
            messagesForModel.push(systemPrompt);
        }

        messagesForModel.push(new HumanMessage(humanInputString));

        let response: AIMessageChunk | undefined;
        for await (const message of await boundModel.stream(messagesForModel)) {
            if (!response) {
                response = message;
            } else {
                response = concat(response, message);
            }
        }

        return {
            messages: response ? [response as AIMessage] : [],
        };
    };

    const workflow = new StateGraph(AgentState)
        .addNode("first_agent", firstModel)
        .addNode("agent", callModel)
        .addNode("action", toolNode)
        .addEdge(START, "first_agent")
        .addConditionalEdges(
            "first_agent",
            shouldContinue,
            {
                continue: "action",
                end: END,
            },
        )
        .addConditionalEdges(
            "agent",
            shouldContinue,
            {
                continue: "action",
                end: END,
            },
        )
        .addEdge("action", "agent");

    const app = workflow.compile();
    return app;
}