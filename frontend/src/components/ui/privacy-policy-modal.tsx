import React from 'react';
import { ShieldCheck, X } from 'lucide-react';

interface PrivacyPolicyModalProps {
  open: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full p-6 relative animate-fadeIn">
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-white p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={onClose}
          aria-label="Close privacy policy"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-6 h-6 text-green-400" />
          <h2 className="text-lg font-bold text-white">Privacy Policy & Data Handling</h2>
        </div>
        <div className="text-gray-200 text-sm space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <p>
            <strong className="text-green-300">Your privacy matters.</strong> All messages are end-to-end encrypted and never stored or shared with third parties. We do not use your data for advertising or profiling.
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Encryption:</strong> All chat content is encrypted in transit and at rest.</li>
            <li><strong>Data Storage:</strong> No chat messages are permanently stored on our servers.</li>
            <li><strong>Analytics:</strong> Only anonymous, aggregated usage data is collected to improve the service. No personal or message content is tracked.</li>
            <li><strong>Cookies:</strong> Only essential cookies are used for authentication and session management.</li>
            <li><strong>Third Parties:</strong> We do not sell or share your data with any third parties.</li>
          </ul>
          <p>
            For more details, please read our full <a href="#" className="text-blue-400 underline hover:text-blue-300">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
};
