import { useState } from "react";
import type { ChatMessage } from "../models/chatMessage";
import { useMutation } from "@tanstack/react-query";
import { type ChatMessageResponse } from "../dto/chatMessageResponse";
import { ChatInput } from "./chatInput";

export const Chat = () => {
    const mutation = useMutation<ChatMessageResponse, Error, string>({
        mutationFn: async (newMessage: string) => {
            const response = await fetch("http://localhost:3000/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ message: newMessage }),
            });
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        },
        onSuccess: (data) => {
            setMessages((prevMessages) => [
                ...prevMessages,
                { text: data.reply, isUser: () => false },
            ]);
        },

    })

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");

    return (
        <div>
            <h1>Chat Component</h1>
            <p>This is a placeholder for the chat functionality.</p>
            {/* Add chat UI components here */}
            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.isUser() ? 'user-message' : 'bot-message'}`}>
                        <div className="message-content">
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>
            <div>
                <ChatInput
                    onSend={(message: string) => {
                        setMessages((prevMessages) => [
                            ...prevMessages,
                            { text: message, isUser: () => true },
                        ]);
                        mutation.mutate(message);
                        setInput("");
                    }}
                />
            </div>

        </div>
    )
}