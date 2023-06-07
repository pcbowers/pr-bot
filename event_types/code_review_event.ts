import { DefineEvent, Schema } from 'deno-slack-sdk/mod.ts'

export const CodeReviewEvent = DefineEvent({
  name: 'code_review_event',
  title: 'Code Review',
  type: Schema.types.object,
  properties: {
    channel_id: { type: Schema.slack.types.channel_id },
    message_ts: { type: Schema.slack.types.message_ts },
    author: { type: Schema.slack.types.user_id },
    claimer: { type: Schema.slack.types.user_id },
    marker: { type: Schema.slack.types.user_id },
    mark: { type: Schema.types.string },
    approver: { type: Schema.slack.types.user_id },
    decliner: { type: Schema.slack.types.user_id },
    priority: { type: Schema.types.string },
    issue_id: { type: Schema.types.string },
    pr_url: { type: Schema.types.string },
    pr_description: { type: Schema.types.string }
  },
  required: ['author', 'channel_id', 'priority', 'issue_id', 'pr_url'],
  additionalProperties: false
})
