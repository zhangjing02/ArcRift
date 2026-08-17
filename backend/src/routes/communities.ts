import { Router, Request, Response } from "express";
import { communityService } from "../services/community";
import { sessionStore } from "../services/storage";
import { logger } from "../utils/logger";

const router = Router();

// GET /api/communities
router.get("/", async (req: Request, res: Response) => {
  const { sessionId, spaceId, limit } = req.query;

  try {
    let targetSpace = typeof spaceId === "string" ? spaceId : (typeof sessionId === "string" ? sessionId : undefined);
    if (targetSpace) {
      const session = (await sessionStore.getSession(targetSpace)) || (await sessionStore.getSessionByName(targetSpace));
      if (session) targetSpace = session._id;
    }

    const communities = await communityService.listCommunities(
      targetSpace,
      typeof limit === "string" ? parseInt(limit, 10) : 20
    );
    res.json({ success: true, communities });
  } catch (err: any) {
    logger.error("Failed to list communities:", err?.message);
    res.status(500).json({ error: "Failed to list communities" });
  }
});

// POST /api/communities/detect
router.post("/detect", async (req: Request, res: Response) => {
  const { sessionId, spaceId } = req.body;

  try {
    let targetSpace = spaceId || sessionId;
    if (targetSpace) {
      const session = (await sessionStore.getSession(targetSpace)) || (await sessionStore.getSessionByName(targetSpace));
      if (session) targetSpace = session._id;
    }

    const communities = await communityService.runCommunityDetection(targetSpace);
    res.json({ success: true, count: communities.length, communities });
  } catch (err: any) {
    logger.error("Failed to run community detection:", err?.message);
    res.status(500).json({ error: "Failed to run community detection" });
  }
});

// GET /api/communities/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const community = await communityService.getCommunityDetails(req.params.id as string);
    if (!community) {
      res.status(404).json({ error: "Community not found" });
      return;
    }
    res.json({ success: true, community });
  } catch (err: any) {
    logger.error("Failed to get community:", err?.message);
    res.status(500).json({ error: "Failed to get community" });
  }
});

export default router;
