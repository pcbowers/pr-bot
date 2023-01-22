import { Manifest } from "deno-slack-sdk/mod.ts";
import { CodeReviewFunction } from "./functions/code_review_function.ts";
import CodeReviewWorkflow from "./workflows/code_review_workflow.ts";
import CodeReviewEvent from "./event_types/code_review_event.ts";

/**
 * The app manifest contains the app's configuration. This
 * file defines attributes like app name and description.
 * https://api.slack.com/future/manifest
 */
export default Manifest({
  name: "pr-bot",
  description: "Manage Pull Request Code Reviews within Slack",
  displayName: "PR Bot",
  icon: "assets/logo.png",
  backgroundColor: "#235784",
  functions: [CodeReviewFunction],
  workflows: [CodeReviewWorkflow],
  events: [CodeReviewEvent],
  outgoingDomains: [],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "chat:write.customize",
  ],
  features: {
    appHome: {
      messagesTabEnabled: false,
      messagesTabReadOnlyEnabled: false,
    },
  },
});
