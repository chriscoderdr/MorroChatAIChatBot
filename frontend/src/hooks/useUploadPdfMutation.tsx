import { useMutation } from '@tanstack/react-query';
import { uploadPdfWithMessageApi, type UploadPdfResponse } from '../services/chat-api';


export const useUploadPdfMutation = () => {
    return useMutation<UploadPdfResponse, Error, { file: File; message: string; onUploadProgress?: (percent: number) => void }>({
        mutationFn: async ({ file, message, onUploadProgress }) => {
            return uploadPdfWithMessageApi(file, message, onUploadProgress);
        },
    });
};
