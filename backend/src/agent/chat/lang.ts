import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { AIMessage, AIMessageChunk, BaseMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { concat } from "@langchain/core/utils/stream";
import { TavilySearch } from "@langchain/tavily";

export const createLangChainApp = async (modelApiKey: string) => {
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
        const humanInput = state.messages[state.messages.length - 1].content || "";
        return {
            messages: [
                new AIMessage({
                    content: "",
                    tool_calls: [
                        {
                            name: "search",
                            args: {
                                query: humanInput,
                            },
                            id: "tool_abcd123",
                        },
                    ],
                }),
            ],
        };
    };

    const workflow = new StateGraph(AgentState)
        .addNode("first_agent", firstModel)
        .addNode("agent", callModel)
        .addNode("action", toolNode)
        .addEdge(START, "first_agent")
        .addConditionalEdges(
            "agent",
            shouldContinue,
            {
                continue: "action",
                end: END,
            },
        )
        .addEdge("action", "agent")
        .addEdge("first_agent", "action");

    const app = workflow.compile();
    
    return app;
}

