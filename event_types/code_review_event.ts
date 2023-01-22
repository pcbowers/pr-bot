import { DefineEvent, Schema } from "deno-slack-sdk/mod.ts";

const CodeReviewEvent = DefineEvent({
  name: "code_review_event",
  title: "Code Review",
  type: Schema.types.object,
  properties: {
    author: { type: Schema.slack.types.user_id },
    claimer: { type: Schema.slack.types.user_id },
    approver: { type: Schema.slack.types.user_id },
  },
  required: ["author"],
  additionalProperties: false,
});

export default CodeReviewEvent;
