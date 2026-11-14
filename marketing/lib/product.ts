/**
 * The product's name, the address an agent connects to, and the one message that connects it.
 * They live here and nowhere else: the product is being renamed and its address will change.
 */
const ADDRESS = "https://cleared-mcp.vercel.app/mcp";

export const PRODUCT = {
  /** Always lowercase. The mark is this word in type. */
  name: "cleared",
  address: ADDRESS,
  /** What "Copy the Message" puts on the clipboard: the visitor sends it to their agent. */
  message: `Add this MCP server: ${ADDRESS}`,
} as const;
