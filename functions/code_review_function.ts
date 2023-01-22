import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import CodeReviewEvent from "../event_types/code_review_event.ts";
import createMessage from "./create_message.ts";

export const CodeReviewFunction = DefineFunction({
  callback_id: "code_review_function",
  title: "Notify your Team with Your Pull Request",
  description:
    "Send a message to your team with your Pull Request details so that they can begin a Code Reivew",
  source_file: "functions/code_review_function.ts",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
      },
      priority: {
        title: "Priority",
        description:
          "The urgency of your pull request that dictates its priority when deciding which Pull Request should be reviewed.",
        type: Schema.types.string,
        enum: ["low", "medium", "high"],
        choices: [{
          value: "low",
          title: "⚪️ Low Priority",
          description: "Not Urgent",
        }, {
          value: "medium",
          title: "🔵 Medium Priority",
          description: "Timely",
        }, {
          value: "high",
          title: "🔴 High Priority",
          description: "Urgent",
        }],
        default: "medium",
      },
      channel: {
        title: "Channel",
        description: "The channel where the Code Review will take place",
        type: Schema.slack.types.channel_id,
      },
      issue_id: {
        title: "Issue ID",
        description: "The ID of the issue (i.e. ABC-1234)",
        type: Schema.types.string,
      },
      issue_url: {
        title: "Issue URL",
        description: "The URL that navigates to the Issue",
        type: Schema.types.string,
      },
      pr_url: {
        title: "Pull Request URL",
        description: "The URL that navigates to the Pull Request",
        type: Schema.types.string,
      },
      pr_description: {
        title: "Pull Request Description",
        description:
          "An optional description that will be posted along with your Pull Request (Supports Markdown).",
        type: Schema.slack.types.rich_text,
      },
    },
    required: [
      "interactivity",
      "channel",
      "priority",
      "issue_id",
      "issue_url",
      "pr_url",
    ],
  },
  output_parameters: {
    properties: {
      author: {
        type: Schema.slack.types.user_id,
        description: "The user who authored the Pull Request",
      },
      claimer: {
        type: Schema.slack.types.user_id,
        description: "The user who claimed the Pull Request",
      },
      approver: {
        type: Schema.slack.types.user_id,
        description: "The user who approved the Pull Request",
      },
    },
    required: ["author"],
  },
});

export default SlackFunction(CodeReviewFunction, async ({ inputs, client }) => {
  const metadata = {
    event_type: CodeReviewEvent,
    event_payload: {
      author: inputs.interactivity.interactor.id,
      claimer: undefined,
      approver: undefined,
    },
  };

  const msgResponse = await client.chat.postMessage({
    channel: inputs.channel,
    blocks: createMessage(inputs, {
      type: "authored",
      metadata: metadata.event_payload,
      complete: false,
    }),
    unfurl_links: false,
    unfurl_media: false,
    username: inputs.issue_id,
    icon_url: "https://github.com/pcbowers/pr-bot/blob/main/assets/logo.png",
    metadata,
    text: "A new Pull Request is ready for Code Review!",
  });

  if (!msgResponse.ok) {
    console.log("Error during request chat.postMessage!", msgResponse.error);
  }

  return { completed: false };
}).addBlockActionsHandler(
  ["claim", "unclaim", "approve", "unapprove", "complete"],
  async ({ action, inputs, body, client }) => {
    const metadata = {
      event_type: CodeReviewEvent,
      event_payload: {
        author: body.message?.metadata?.event_payload.author as string ??
          undefined,
        claimer: action.action_id === "unclaim"
          ? undefined
          : body.message?.metadata?.event_payload.claimer as string ??
            undefined,
        approver: action.action_id === "unapprove"
          ? undefined
          : body.message?.metadata?.event_payload.approver as string ??
            undefined,
      },
    };

    const msgResponse = await client.chat.update({
      channel: body.container.channel_id,
      ts: body.container.message_ts,
      blocks: createMessage(inputs, {
        type: metadata.event_payload.approver
          ? "approved"
          : metadata.event_payload.claimer
          ? "claimed"
          : "authored",
        metadata: metadata.event_payload,
        complete: action.action_id === "complete" ? true : false,
      }),
      metadata,
    });

    if (!msgResponse.ok) {
      console.log("Error during request chat.update!", msgResponse.error);
    }

    if (action.action_id === "complete") {
      return {
        outputs: {
          author: body.message?.metadata?.event_payload.author as string ??
            undefined,
          claimer: body.message?.metadata?.event_payload.claimer as string ??
            undefined,
          approver: body.message?.metadata?.event_payload.approver as string ??
            undefined,
        },
      };
    }
    console.log("huh");
    return { completed: false };
  },
).addBlockActionsHandler(["delete"], async ({ body, client }) => {
  const msgResponse = await client.chat.delete({
    channel: body.container.channel_id,
    ts: body.container.message_ts,
  });

  if (!msgResponse.ok) {
    console.log("Error during request chat.delete!", msgResponse.error);
  }

  return {
    outputs: {
      author: body.message?.metadata?.event_payload.author as string ??
        undefined,
      claimer: body.message?.metadata?.event_payload.claimer as string ??
        undefined,
      approver: body.message?.metadata?.event_payload.approver as string ??
        undefined,
    },
  };
});
