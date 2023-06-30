import { SlackAPIClient } from 'deno-slack-api/types.ts'
import { BlockActionsBody } from 'deno-slack-sdk/functions/interactivity/block_actions_types.ts'
import { ViewSubmissionBody } from 'deno-slack-sdk/functions/interactivity/view_types.ts'
import { FunctionRuntimeParameters } from 'deno-slack-sdk/functions/types.ts'
import { CodeReviewFunction } from '../code_review_function.ts'
import { createCodeReviewMetadata } from './review_metadata.ts'
import { formatPrTitle } from './review_message.ts'

type EventPayload = Partial<ReturnType<typeof createCodeReviewMetadata>['event_payload']>

export async function codeReviewNotification(
  client: SlackAPIClient,
  channelId: string,
  timestamp: string,
  userToNotify: string,
  responsibleUser: string,
  action_id: string,
  event_payload: EventPayload
) {
  if (userToNotify === responsibleUser) return

  const notificationMessage = getNotificationMessage(action_id, event_payload, responsibleUser)
  if (!notificationMessage) return

  const icon = getIcon(action_id, event_payload.mark)

  const postNotification = await client.chat.postMessage({
    channel: channelId,
    thread_ts: timestamp,
    unfurl_links: false,
    unfurl_media: false,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${icon} <@${userToNotify}>, ` + notificationMessage
        }
      }
    ],
    text: notificationMessage
  })

  if (!postNotification.ok) {
    console.log('Error during request chat.postMessage!', postNotification)
  }
}

export function userToNotify(
  body: BlockActionsBody | ViewSubmissionBody,
  inputs: FunctionRuntimeParameters<
    NonNullable<typeof CodeReviewFunction.definition.input_parameters>['properties'],
    NonNullable<typeof CodeReviewFunction.definition.input_parameters>['required']
  >,
  action_id = ''
) {
  if (!action_id.startsWith('un')) return inputs.interactivity.interactor.id
  return (
    body.message?.metadata?.event_payload?.decliner ??
    body.message?.metadata?.event_payload?.approver ??
    body.message?.metadata?.event_payload?.marker ??
    body.message?.metadata?.event_payload?.claimer ??
    inputs.interactivity.interactor.id
  )
}

function getIcon(action_id: string, mark = '') {
  if (action_id === 'unapprove') return ':open_book:'
  if (action_id === 'approve') return ':white_check_mark:'
  if (action_id === 'undecline') return ':open_book:'
  if (action_id === 'decline') return ':no_entry_sign:'
  if (action_id === 'claim') return ':eyes:'
  if (action_id === 'unclaim') return ':dark_sunglasses:'
  if (action_id === 'edit') return ':pencil2:'
  if (action_id === 'unmark') return ':black_nib:'
  if (action_id === 'mark') {
    if (mark === 'Needs Work') return ':construction:'
  }
  return ':tada:'
}

function getNotificationMessage(action_id: string, event_payload: EventPayload, currentUserId: string) {
  const pullRequest = `<${event_payload.pr_url}|Pull Request>`
  const title = `_(${formatPrTitle(event_payload.pr_title)})_`

  if (action_id === 'unapprove') {
    return `<@${currentUserId}> Re-Opened (Unapproved) the ${pullRequest} ${title}.`
  }

  if (action_id === 'approve') {
    return `<@${currentUserId}> Approved the ${pullRequest} ${title}.`
  }

  if (action_id === 'undecline') {
    return `<@${currentUserId}> Re-Opened (Un-Declined) the ${pullRequest} ${title}.`
  }

  if (action_id === 'decline') {
    return `<@${currentUserId}> Declined the ${pullRequest} ${title}`
  }

  if (action_id === 'claim') {
    return `<@${currentUserId}> Claimed the ${pullRequest} ${title}`
  }

  if (action_id === 'unclaim') {
    return `<@${currentUserId}> Unclaimed the ${pullRequest} ${title}`
  }

  if (action_id === 'mark') {
    return `<@${currentUserId}> Marked the ${pullRequest} as '${event_payload.mark}' ${title}`
  }

  if (action_id === 'unmark') {
    return `<@${currentUserId}> Unmarked the ${pullRequest} ${title}`
  }

  if (action_id === 'edit') {
    return `<@${currentUserId}> Edited the ${pullRequest} Review ${title}`
  }
}
