import { BlockActionsBody } from 'deno-slack-sdk/functions/interactivity/block_actions_types.ts'
import { BlockAction } from 'deno-slack-sdk/functions/interactivity/block_kit_types.ts'
import { FunctionRuntimeParameters } from 'deno-slack-sdk/functions/types.ts'
import { CodeReviewEvent } from '../../event_types/code_review_event.ts'
import { CodeReviewFunction } from '../code_review_function.ts'
import { ViewSubmissionBody } from 'https://deno.land/x/deno_slack_sdk@2.1.2/functions/interactivity/view_types.ts'

export function createCodeReviewMetadata(
  action: BlockAction,
  body: BlockActionsBody | ViewSubmissionBody,
  inputs: FunctionRuntimeParameters<
    NonNullable<typeof CodeReviewFunction.definition.input_parameters>['properties'],
    NonNullable<typeof CodeReviewFunction.definition.input_parameters>['required']
  >
) {
  return {
    event_type: CodeReviewEvent,
    event_payload: {
      channel_id: body.container.channel_id ?? inputs.channel_id,
      message_ts: body.container.message_ts,
      author: body.message?.metadata?.event_payload?.author,
      claimer:
        action.action_id === 'unclaim'
          ? undefined
          : action.action_id === 'claim'
          ? body.user.id
          : body.message?.metadata?.event_payload?.claimer,
      approver:
        action.action_id === 'unapprove'
          ? undefined
          : action.action_id === 'approve'
          ? body.user.id
          : body.message?.metadata?.event_payload?.approver,
      decliner:
        action.action_id === 'undecline'
          ? undefined
          : action.action_id === 'decline'
          ? body.user.id
          : body.message?.metadata?.event_payload?.decliner,
      priority: body.message?.metadata?.event_payload?.priority ?? inputs.priority,
      issue_id: body.message?.metadata?.event_payload?.issue_id ?? inputs.issue_id,
      pr_url: body.message?.metadata?.event_payload?.pr_url ?? inputs.pr_url,
      pr_description: body.message?.metadata?.event_payload?.pr_description ?? inputs.pr_description
    }
  }
}
