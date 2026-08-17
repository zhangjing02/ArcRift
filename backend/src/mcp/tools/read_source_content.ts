import { sourceStore } from "../../services/storage";

export async function readSourceContent(args: { source_id: string; offset?: number; limit?: number }) {
  const { source_id, offset = 0, limit = 8000 } = args;

  if (!source_id) {
    throw new Error("source_id is required");
  }

  const source = await sourceStore.getSource(source_id);
  if (!source) {
    throw new Error(`Source ${source_id} not found`);
  }

  const fullContent = source.rawContent || source.summary || "";
  const slice = fullContent.slice(offset, offset + limit);
  const hasMore = offset + limit < fullContent.length;

  return {
    source_id: source.id,
    name: source.name,
    source_type: source.sourceType,
    url: source.url,
    total_length: fullContent.length,
    offset,
    limit,
    has_more: hasMore,
    content: slice,
  };
}
