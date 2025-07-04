import React, { useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface FAQModalProps {
  open: boolean;
  onClose: () => void;
}

const FAQS = [
  {
    q: 'Is my chat data private?',
    a: 'Yes. All messages are end-to-end encrypted and never stored or shared with third parties.'
  },
  {
    q: 'How do I start a new chat?',
    a: 'Click the “New Chat” button in the sidebar to begin a fresh conversation.'
  },
  {
    q: 'Can I upload files?',
    a: 'Yes, you can upload supported files (like PDFs) using the upload button in the chat input.'
  },
  {
    q: 'What if I see an error?',
    a: 'You can retry sending your message or contact support if the issue persists.'
  },
  {
    q: 'Where can I find the privacy policy?',
    a: 'Click the “Privacy Policy” link in the header for full details on data handling.'
  },
  {
    q: 'Who can I contact for help?',
    a: 'Use the help button in the header or email support@morrochat.com.'
  }
];

export const FAQModal: React.FC<FAQModalProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full p-6 relative animate-in zoom-in-95 duration-200 my-auto">
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-white p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={onClose}
          aria-label="Close FAQ"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-6 h-6 text-blue-400" />
          <h2 className="text-lg font-bold text-white">Help & FAQ</h2>
        </div>
        <div className="text-gray-200 text-sm space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {FAQS.map((item, idx) => (
            <div key={idx}>
              <div className="font-semibold text-blue-300 mb-1">Q: {item.q}</div>
              <div className="ml-2 text-gray-200">A: {item.a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
