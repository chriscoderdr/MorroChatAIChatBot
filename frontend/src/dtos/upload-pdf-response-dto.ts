export interface UploadPdfResponse {
  filename: string;
  mimetype: string;
  size: number;
  message: string;
  status: string;
  answer?: string;
}