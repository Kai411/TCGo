// The `qrcode` package ships no types. Both the label printer and the POS
// import it dynamically through a narrow surface, so a module declaration is
// enough — @types/qrcode would be a dependency for two call sites.
declare module "qrcode" {
  interface ToDataURLOptions {
    margin?: number;
    width?: number;
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    color?: { dark?: string; light?: string };
  }
  export function toDataURL(text: string, options?: ToDataURLOptions): Promise<string>;
  const _default: { toDataURL: typeof toDataURL };
  export default _default;
}
