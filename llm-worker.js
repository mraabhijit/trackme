/* Module worker for on-device AI: runs the WebLLM engine away from the page so the app stays responsive. */
import { WebWorkerMLCEngineHandler } from './vendor/web-llm/web-llm.js';
var handler = new WebWorkerMLCEngineHandler();
self.onmessage = function (msg) { handler.onmessage(msg); };
