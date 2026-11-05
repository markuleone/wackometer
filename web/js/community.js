// Community: today's Daily W on top, the crowd feed of posted lyrics below. Loaded when the tab opens.
import { loadDaily } from "./daily.js";
import { loadWall } from "./wall.js";

export function loadCommunity() { loadDaily(); loadWall(); }
