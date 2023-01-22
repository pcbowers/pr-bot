import { WorkflowStepInputs } from "deno-slack-sdk/workflows/types.ts";
import { CodeReviewFunction } from "./code_review_function.ts";
import CodeReviewEvent from "../event_types/code_review_event.ts";

type RequireKeys<T extends unknown, K extends keyof T> =
  (Required<Pick<T, K>> & Omit<T, K>) extends infer O ? { [P in keyof O]: O[P] }
    : never;

type Metadata = Partial<
  {
    [P in keyof (typeof CodeReviewEvent.definition.properties)]: string;
  }
>;

type State = {
  type: "authored" | "claimed" | "approved";
  metadata: RequireKeys<Metadata, "author">;
  complete: boolean;
};

type FunctionInputs = WorkflowStepInputs<
  NonNullable<
    typeof CodeReviewFunction.definition.input_parameters
  >["properties"],
  NonNullable<
    typeof CodeReviewFunction.definition.input_parameters
  >["required"]
>;

function getIcon(state: State) {
  if (state.type === "authored") return ":tada:";
  if (state.type === "claimed") return ":eyes:";
  if (state.type === "approved") return ":white_check_mark:";
  return ":tada:";
}

function getPriority(priority: FunctionInputs["priority"]) {
  if (priority === "low") return "⚪️ Low Priority (Not Urgent)";
  if (priority === "medium") return "🔵 Medium Priority (Timely)";
  if (priority === "high") return "🔴 High Priority (Urgent)";
  return "🔵 Medium Priority (Timely)";
}

function getLogs(state: State) {
  const text = [`_Authored By: *<@${state.metadata.author}>*_`];

  if (state.metadata.claimer) {
    text.push(`_Claimed By: *<@${state.metadata.claimer}>*_`);
  }

  if (state.metadata.approver) {
    text.push(`_Approved By: *<@${state.metadata.approver}>*_`);
  }

  return [{
    type: "section",
    text: {
      type: "mrkdwn",
      text: text.join("\n"),
    },
  }];
}

function getButtons(state: State) {
  if (state.complete) return [];

  const baseButtons = [{
    type: "button",
    text: {
      type: "plain_text",
      emoji: true,
      text: "Complete",
    },
    confirm: {
      title: {
        type: "plain_text",
        text: "Are you sure?",
      },
      text: {
        type: "mrkdwn",
        text:
          "By marking this as complete, you will no longer be able to update the claim or approval status. Are you sure you want to do this?",
      },
      confirm: {
        type: "plain_text",
        text: "Do it",
      },
      deny: {
        type: "plain_text",
        text: "Stop, I've changed my mind!",
      },
      style: "danger",
    },
    ...(state.metadata.approver ? { style: "primary" } : {}),
    action_id: "complete",
  }, {
    type: "button",
    text: {
      type: "plain_text",
      emoji: true,
      text: "Delete",
    },
    confirm: {
      title: {
        type: "plain_text",
        text: "Are you sure?",
      },
      text: {
        type: "mrkdwn",
        text:
          "Once deleted, you will not be able to recover this message. Are you sure you want to do this?",
      },
      confirm: {
        type: "plain_text",
        text: "Do it",
      },
      deny: {
        type: "plain_text",
        text: "Stop, I've changed my mind!",
      },
      style: "danger",
    },
    style: "danger",
    action_id: "delete",
  }];

  if (state.type === "authored") {
    return [{
      type: "button",
      text: {
        type: "plain_text",
        emoji: true,
        text: "Claim",
      },
      style: "primary",
      action_id: "claim",
    }, {
      type: "button",
      text: {
        type: "plain_text",
        emoji: true,
        text: "Approve",
      },
      action_id: "approve",
    }, ...baseButtons];
  }

  if (state.type === "claimed") {
    return [{
      type: "button",
      text: {
        type: "plain_text",
        emoji: true,
        text: "Remove Claim",
      },
      action_id: "unclaim",
    }, {
      type: "button",
      text: {
        type: "plain_text",
        emoji: true,
        text: "Approve",
      },
      style: "primary",
      action_id: "approve",
    }, ...baseButtons];
  }

  if (state.type === "approved" && !state.metadata.claimer) {
    return [{
      type: "button",
      text: {
        type: "plain_text",
        emoji: true,
        text: "Claim",
      },
      action_id: "claim",
    }, {
      type: "button",
      text: {
        type: "plain_text",
        emoji: true,
        text: "Remove Approval",
      },
      action_id: "unapprove",
    }, ...baseButtons];
  }

  if (state.type === "approved" && state.metadata.claimer) {
    return [{
      type: "button",
      text: {
        type: "plain_text",
        emoji: true,
        text: "Remove Claim",
      },
      action_id: "unclaim",
    }, {
      type: "button",
      text: {
        type: "plain_text",
        emoji: true,
        text: "Remove Approval",
      },
      action_id: "unapprove",
    }, ...baseButtons];
  }

  return baseButtons;
}

export default function createMessage(
  inputs: FunctionInputs,
  state: State,
) {
  const icon = getIcon(state);
  const priority = getPriority(inputs.priority);
  const logs = getLogs(state);
  const buttons = getButtons(state);

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${icon} Pull Request for ${inputs.issue_id} ${icon}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text:
            `*${priority}*  | <${inputs.pr_url}|See Pull Request> or <${inputs.issue_url}|See Issue>`,
        },
      ],
    },
    ...(inputs.pr_description
      ? [{
        type: "divider",
      }, ...inputs.pr_description]
      : []),
    ...logs,
    ...(buttons.length
      ? [{
        type: "divider",
      }, {
        type: "actions",
        elements: buttons,
      }]
      : []),
  ];
}
