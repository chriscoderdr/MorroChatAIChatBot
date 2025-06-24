import { useState } from "react";

export const ChatInput = ({ onSend }: { onSend: (message: string) => void }) => {
    const [input, setInput] = useState("");
    const handleSend = () => {
        if (input.trim()) {
            onSend(input);
            setInput("");
        }
    };
    return (
        <div className="chat-input">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="input-field"
            />
            <button onClick={handleSend} className="send-button">
                Send
            </button>
        </div>
    );
}