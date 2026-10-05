/// <reference types="vite/client" />
declare module "qrcode" {
  const QRCode: { toDataURL: (text: string, options?: any) => Promise<string> };
  export default QRCode;
}
