export const ChatMessage = ({ message, isUser }: { message: string; isUser: boolean }) => {
    return (
        <div className={`chat-message ${isUser ? 'user-message' : 'bot-message'}`}>
            <div className="message-content">
                {message}
            </div>
        </div>
    );
}
