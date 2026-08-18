import { SqliteGraphStore } from "../src/services/sqlite-graph";

async function main() {
  const store = new SqliteGraphStore();
  const data = await store.getGraphData({});
  console.log("=== Knowledge Graph Test ===");
  console.log(`Total Nodes: ${data.nodes.length}`);
  console.log(`Total Links: ${data.links.length}`);
  console.log("Sample Nodes:", data.nodes.slice(0, 3));
  console.log("Sample Links:", data.links.slice(0, 3));
}

main().catch(console.error);
