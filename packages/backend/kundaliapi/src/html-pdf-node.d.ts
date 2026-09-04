declare module "html-pdf-node" {
  interface File {
    content?: string;
    path?: string;
    url?: string;
  }
  interface Options {
    format?: string;
    width?: string;
    height?: string;
    margin?: { top?: string; right?: string; bottom?: string; left?: string };
    printBackground?: boolean;
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
  }
  function generatePdf(file: File, options?: Options): Promise<Buffer>;
  function generatePdfs(files: File[], options?: Options): Promise<Buffer[]>;
  export { generatePdf, generatePdfs };
  export default { generatePdf, generatePdfs };
}
