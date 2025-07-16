import React, { useState, useEffect, useRef } from 'react';
import {
    PlusCircle,
    MessageSquare,
    Mic,
    Camera,
    Send,
    Globe,
    Bot,
    XCircle,
    Menu,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { databases, ID } from "../appwrite/client";
import { Query } from "appwrite";

const backendURL = import.meta.env.VITE_BACKEND_URL;
const APPWRITE_DB_ID = import.meta.env.VITE_APPWRITE_DB_ID;
const APPWRITE_CHAT_COLLECTION_ID = import.meta.env.VITE_APPWRITE_CHAT_COLLECTION_ID;

const AICopilotChat = ({ user, getUserDisplayName }) => {
    const [chatMessages, setChatMessages] = useState([]);
    const [allUserMessages, setAllUserMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [language, setLanguage] = useState('english');
    const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
    const [chatSessions, setChatSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const fileInputRef = useRef(null);
    const recognitionRef = useRef(null);
    const langDropdownRef = useRef(null);
    
    const chatSuggestions = [
        "What to stock this month?",
        "Make listing for this product photo",
        "Why are my sales down?",
        "Best pricing for my silk sarees?"
    ];

    const getRelativeTime = (date) => {
        const now = new Date();
        const seconds = Math.round((now - date) / 1000);
        const minutes = Math.round(seconds / 60);
        const hours = Math.round(minutes / 60);
        const days = Math.round(hours / 24);

        if (seconds < 60) return "just now";
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (days === 1) return `1 day ago`;
        if (days < 30) return `${days} days ago`;

        return new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    };

    const processChatHistoryToSessions = (messages) => {
        if (!messages || messages.length === 0) {
            setChatSessions([]);
            return;
        }
        const sessions = messages.reduce((acc, msg) => {
            const sessionId = msg.session_id;
            if (!acc[sessionId]) {
                acc[sessionId] = {
                    id: sessionId,
                    preview: msg.content.substring(0, 40) + '...',
                    rawTimestamp: new Date(msg.rawCreatedAt).getTime(),
                    messages: []
                };
            }
            acc[sessionId].messages.push(msg);
            acc[sessionId].rawTimestamp = Math.max(acc[sessionId].rawTimestamp, new Date(msg.rawCreatedAt).getTime());
            return acc;
        }, {});

        const sortedSessions = Object.values(sessions)
            .sort((a, b) => b.rawTimestamp - a.rawTimestamp)
            .map(session => {
                const lastMessageDate = new Date(session.rawTimestamp);
                return {
                    ...session,
                    time: getRelativeTime(lastMessageDate),
                    title: `Chat from ${lastMessageDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
                };
            });
        setChatSessions(sortedSessions);
    };

    const fetchChatHistory = async (currentUser) => {
        const showGreeting = (userForGreeting) => {
            setCurrentSessionId(null);
            setChatMessages([{
                id: 'greeting-initial',
                type: 'bot',
                content: `Namaste ${userForGreeting ? getUserDisplayName(userForGreeting) : ''}! How can I help you grow your business today?`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        };

        if (!currentUser || !APPWRITE_CHAT_COLLECTION_ID) {
            showGreeting(currentUser);
            return;
        }

        showGreeting(currentUser); // Always show greeting on load

        try {
            const res = await databases.listDocuments(
                APPWRITE_DB_ID,
                APPWRITE_CHAT_COLLECTION_ID,
                [Query.equal('user_id', currentUser.uid), Query.orderAsc('$createdAt'), Query.limit(100)]
            );

            const userMessages = res.documents.map(doc => ({
                id: doc.$id,
                type: doc.type,
                content: doc.content,
                session_id: doc.session_id,
                rawCreatedAt: doc.$createdAt,
                timestamp: new Date(doc.$createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }));

            setAllUserMessages(userMessages);
            processChatHistoryToSessions(userMessages); // Process all messages for the sidebar

        } catch (err) {
            console.error("Failed to fetch chat history:", err);
            // Greeting is already set, just clear history from sidebar on error
            setChatSessions([]);
            setAllUserMessages([]);
        }
    };

    useEffect(() => {
        if (user) {
            fetchChatHistory(user);
        }
    }, [user]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (langDropdownRef.current && !langDropdownRef.current.contains(event.target)) {
                setIsLangDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- Speech Recognition Logic ---
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            const recognition = recognitionRef.current;
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = language === 'hindi' ? 'hi-IN' : 'en-US';

            recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                setChatInput(finalTranscript + interimTranscript);
            };
            
            recognition.onerror = (event) => {
                console.error("Speech recognition error:", event.error);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false); // Always set listening to false when it ends
            };
        } else {
            console.warn("Speech recognition not supported in this browser.");
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [language]);

    const handleListen = () => {
        const recognition = recognitionRef.current;
        if (recognition) {
            if (isListening) {
                recognition.stop();
                setIsListening(false);
            } else {
                setChatInput(''); // Clear input before starting
                recognition.start();
                setIsListening(true);
            }
        }
    };

    const handleImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setSelectedImage(null);
        setImagePreview(null);
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSendMessage = async () => {
        // Stop listening if a message is sent manually
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }

        if ((!chatInput.trim() && !selectedImage) || isLoading) return;
        const currentChatInput = chatInput;
        const imageToSend = selectedImage; // Capture the image to send
        
        // --- Reset UI immediately ---
        setChatInput('');
        setSelectedImage(null);
        setImagePreview(null);
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        
        const sessionId = currentSessionId || ID.unique();
        if (!currentSessionId) setCurrentSessionId(sessionId);

        const userMessage = {
            id: ID.unique(),
            type: 'user',
            content: currentChatInput,
            image: imageToSend ? URL.createObjectURL(imageToSend) : null, // for local display
            session_id: sessionId,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rawCreatedAt: new Date().toISOString(),
        };

        const historyForBackend = chatMessages.filter(m => !m.id.startsWith('greeting')).slice(-5).map(msg => ({
            role: msg.type === 'bot' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));
        
        const newViewMessages = chatMessages.some(m => m.id.startsWith('greeting')) ? [userMessage] : [...chatMessages, userMessage];
        setChatMessages(newViewMessages);
        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('current_query', currentChatInput);
            formData.append('language', language);
            formData.append('history_str', JSON.stringify(historyForBackend));
            if (imageToSend) {
                formData.append('image', imageToSend);
            }

            const response = await fetch(`${backendURL}/api/chat`, {
                method: 'POST',
                body: formData // No 'Content-Type' header, browser sets it for FormData
            });

            if (!response.ok) throw new Error((await response.json()).detail || `API call failed`);
            const result = await response.json();
            const aiResponse = {
                id: ID.unique(), type: 'bot', content: result.reply, session_id: sessionId,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                rawCreatedAt: new Date().toISOString(),
            };
            setChatMessages(prev => [...prev, aiResponse]);

            if (user && APPWRITE_CHAT_COLLECTION_ID) {
                await databases.createDocument(APPWRITE_DB_ID, APPWRITE_CHAT_COLLECTION_ID, userMessage.id, { user_id: user.uid, type: 'user', content: userMessage.content, session_id: sessionId });
                await databases.createDocument(APPWRITE_DB_ID, APPWRITE_CHAT_COLLECTION_ID, aiResponse.id, { user_id: user.uid, type: 'bot', content: aiResponse.content, session_id: sessionId });
                const newAllMessages = [...allUserMessages, userMessage, aiResponse];
                setAllUserMessages(newAllMessages);
                processChatHistoryToSessions(newAllMessages);
            }
        } catch (error) {
            console.error("Error fetching AI response from backend:", error);
            const errorResponse = {
                id: Date.now() + 1, type: 'bot', content: `Oops! Something went wrong. ${error.message}`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setChatMessages(prev => [...prev, errorResponse]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewChat = () => {
        setCurrentSessionId(null);
        setChatMessages([{
            id: user ? 'greeting-new-chat' : 'greeting-generic', type: 'bot',
            content: `Namaste ${user ? getUserDisplayName(user) : ''}! How can I help you grow your business today?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
    };

    const handleSessionClick = (sessionId) => {
        const sessionMessages = allUserMessages.filter(msg => msg.session_id === sessionId);
        setChatMessages(sessionMessages);
        setCurrentSessionId(sessionId);
    };

    const handleSuggestionClick = (suggestion) => {
        setChatInput(suggestion);
    };

    return (
        <div className="flex h-screen font-sans bg-gray-100 text-gray-800">
            {/* Sidebar for Chat History */}
            <div className={`
                flex-shrink-0 bg-white border-r border-gray-200 
                transition-all duration-300 ease-in-out
                ${isSidebarOpen ? 'w-72' : 'w-0'}
            `}>
                <div className="w-72 h-full flex flex-col overflow-hidden">
                    <div className="p-4 flex justify-between items-center border-b border-gray-200 flex-shrink-0">
                        <h2 className="text-xl font-bold text-gray-800">Chat History</h2>
                        <button
                            onClick={handleNewChat}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="New Chat"
                        >
                            <PlusCircle className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="overflow-y-auto flex-grow">
                        {chatSessions.length > 0 ? (
                            chatSessions.map((session) => (
                                <div
                                    key={session.id}
                                    onClick={() => handleSessionClick(session.id)}
                                    className={`
                                        p-4 cursor-pointer border-l-4
                                        ${currentSessionId === session.id ? 'border-indigo-500 bg-gray-100' : 'border-transparent hover:bg-gray-50'}
                                    `}
                                >
                                    <div className="font-semibold text-sm truncate">{session.preview}</div>
                                    <div className="text-xs text-gray-500 mt-1">{session.time}</div>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-sm text-gray-500">
                                No past conversations.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
                <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="Toggle Sidebar"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <h1 className="text-xl font-bold text-gray-800">AI Copilot Chat</h1>
                    </div>
                    <div className="relative" ref={langDropdownRef}>
                         <button
                            onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                            className="flex items-center gap-2 bg-gray-100 border border-gray-300 text-gray-800 p-2 pl-4 pr-3 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        >
                            <Globe className="w-5 h-5 text-gray-500" />
                            <span className="font-medium">{language.charAt(0).toUpperCase() + language.slice(1)}</span>
                            {isLangDropdownOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {isLangDropdownOpen && (
                            <ul className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                                <li>
                                    <a onClick={() => { setLanguage('english'); setIsLangDropdownOpen(false); }}
                                       className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">English</a>
                                </li>
                                <li>
                                    <a onClick={() => { setLanguage('hindi'); setIsLangDropdownOpen(false); }}
                                       className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">Hindi</a>
                                </li>
                                <li>
                                    <a onClick={() => { setLanguage('hinglish'); setIsLangDropdownOpen(false); }}
                                       className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">Hinglish</a>
                                </li>
                            </ul>
                        )}
                    </div>
                </header>
                
                {/* Chat Messages */}
                 <div id="chat-container" className="flex-1 p-6 overflow-y-auto space-y-6">
                    {chatMessages.map((msg, index) => (
                        <div key={msg.id || index} className={`flex items-start gap-4 ${msg.type === 'user' ? 'justify-end' : ''}`}>
                             {msg.type === 'bot' && (
                                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white flex-shrink-0">
                                    <Bot size={24} />
                                </div>
                            )}
                            <div className={`max-w-xl p-4 rounded-xl ${msg.type === 'user' ? 'bg-indigo-500 text-white' : 'bg-white text-gray-800 shadow-sm'}`}>
                                {msg.image && <img src={msg.image} alt="uploaded content" className="rounded-lg mb-2 max-w-xs"/>}
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                <div className="text-xs mt-2 opacity-70 text-right">{msg.timestamp}</div>
                            </div>
                            {msg.type === 'user' && (
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold flex-shrink-0">
                                    {getUserDisplayName(user)[0]}
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white flex-shrink-0">
                                <Bot size={24} />
                            </div>
                            <div className="max-w-xl p-4 rounded-xl bg-white text-gray-800 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Greeting / Suggestions */}
                {chatMessages.length === 1 && chatMessages[0].id === 'greeting-initial' && (
                     <div className="px-6 pb-6 flex items-center gap-4">
                        <p className="text-sm text-gray-600 font-medium flex-shrink-0">Suggestions:</p>
                        <div className="flex-1 flex gap-2 overflow-x-auto pb-2">
                            {chatSuggestions.map(s => (
                                <button
                                    key={s}
                                    onClick={() => handleSuggestionClick(s)}
                                    className="p-2 px-3 bg-white text-gray-700 rounded-lg text-sm text-left border border-gray-200 hover:bg-gray-200 transition whitespace-nowrap"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Chat Input */}
                <div className="p-4 border-t border-gray-200 bg-white">
                    {imagePreview && (
                        <div className="relative w-24 h-24 mb-2">
                            <img src={imagePreview} alt="Selected" className="w-full h-full object-cover rounded-lg" />
                            <button
                                onClick={handleRemoveImage}
                                className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full p-1"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>
                    )}
                    <div className="relative flex items-center">
                        <button onClick={() => fileInputRef.current.click()} className="p-2 text-gray-500 hover:text-indigo-600">
                            <Camera size={24} />
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="hidden"
                        />
                        <button onClick={handleListen} className={`p-2 ${isListening ? 'text-red-500' : 'text-gray-500 hover:text-indigo-600'}`}>
                            <Mic size={24} />
                        </button>
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey ? (e.preventDefault(), handleSendMessage()) : null}
                            placeholder="Type your message, or ask about a product image..."
                            className="w-full p-3 pl-4 bg-gray-100 border border-transparent text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                            disabled={isLoading}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={(!chatInput.trim() && !selectedImage) || isLoading}
                            className="ml-3 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AICopilotChat;