import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';

const FeedbackPage = () => {
    const navigate = useNavigate();
    const { feedbackHistory: list, setFeedbackHistory: setList } = usePlayer();
    const [username, setUsername] = useState('');
    const [message, setMessage] = useState('');

    const save = (ev) => {
        ev.preventDefault();
        if (!message.trim()) return alert('Please write your feedback.');
        const entry = { id: Date.now(), username: username.trim() || 'Anonymous', message: message.trim(), createdAt: new Date().toISOString() };
        setList(current => [entry, ...current].slice(0, 100));
        setMessage('');
    };

    return (
        <div className="p-6">
            <div className="max-w-2xl mx-auto">
                <div className="mb-6">
                    <button type="button" onClick={() => navigate(-1)} className="text-gray-300 hover:underline">← Back</button>
                    <h1 className="text-2xl font-bold mt-3">Feedback</h1>
                    <p className="text-gray-400">Share your feedback — it will be shown here.</p>
                </div>

                <form onSubmit={save} className="mb-6">
                    <input placeholder="Your name (optional)" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-3 py-2 mb-3 bg-[#1f1f1f] border border-gray-700 rounded-md text-white" />
                    <textarea placeholder="Your feedback" value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full px-3 py-2 mb-3 bg-[#1f1f1f] border border-gray-700 rounded-md text-white" />
                    <div className="flex gap-2">
                        <button type="submit" className="px-4 py-2 bg-blue-600 rounded-full text-white">Submit</button>
                        <button type="button" onClick={() => { setUsername(''); setMessage(''); }} className="px-4 py-2 text-gray-400">Clear</button>
                    </div>
                </form>

                <div>
                    <h2 className="text-lg font-semibold mb-3">Recent feedback</h2>
                    {list.length === 0 ? (
                        <p className="text-gray-400">No feedback yet — be the first.</p>
                    ) : (
                        <div className="space-y-3">
                            {list.map(f => (
                                <div key={f.id} className="bg-[#1f1f1f] p-3 rounded-md">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="font-semibold">{f.username}</div>
                                        <div className="text-xs text-gray-400">{new Date(f.createdAt).toLocaleString()}</div>
                                    </div>
                                    <div className="text-gray-200">{f.message}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FeedbackPage;
