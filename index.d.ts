import { PluginObj } from "@babel/core";
import { SourceLocation } from "@babel/types";
import { OptionsSchema } from "./options";
interface PartnerVariation {
  [key: string]: string;
}
interface MessageDescriptor {
  id: string;
  defaultMessage?: string;
  description?: string;
  partners?: string;
  partnerVariations?: PartnerVariation;
}
export declare type ExtractedMessageDescriptor = MessageDescriptor &
  Partial<SourceLocation> & {
    file?: string;
  };
export declare type ExtractionResult<M = Record<string, string>> = {
  messages: ExtractedMessageDescriptor[];
  meta: M;
};
declare const _default: (
  api: object,
  options: OptionsSchema | null | undefined,
  dirname: string
) => PluginObj<import("@babel/core").PluginPass>;
export default _default;
export { OptionsSchema } from "./options";
//# sourceMappingURL=index.d.ts.map
