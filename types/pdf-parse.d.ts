declare module "pdf-parse" {
  interface Metadata {
    info: Record<string, unknown>;
  }

  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: Metadata;
    metadata?: Metadata;
    text: string;
    version: string;
  }

  type PdfParse = (data: Buffer, options?: Record<string, unknown>) => Promise<PdfParseResult>;

  const pdfParse: PdfParse;
  export default pdfParse;
}
