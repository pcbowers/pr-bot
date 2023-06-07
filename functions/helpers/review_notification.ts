import { SlackAPIClient } from 'deno-slack-api/types.ts'
import { getCodeReviewPriority } from './review_message.ts'
import { createCodeReviewMetadata } from './review_metadata.ts'

type EventPayload = Partial<ReturnType<typeof createCodeReviewMetadata>['event_payload']>

export async function codeReviewNotification(
  client: SlackAPIClient,
  channelId: string,
  timestamp: string,
  responsibleUser: string,
  action_id: string,
  event_payload: EventPayload
) {
  const permalink = await getPermalink(client, channelId, timestamp)
  const icon = getIcon(action_id, event_payload.mark)
  const priority = getCodeReviewPriority(event_payload.priority)
  const issueUrlPrefix = 'https://jira.os.liberty.edu/browse/'
  const notificationMessage = getNotificationMessage(action_id, event_payload, responsibleUser)

  return [
    ...new Set([...(event_payload.subscribed as string[]), ...(action_id === 'unsubscribe' ? [responsibleUser] : [])])
  ]
    .filter((userToNotify) => userToNotify !== responsibleUser || ['subscribe', 'unsubscribe'].includes(action_id))
    .forEach(async (userToNotify) => {
      const postNotification = await client.chat.postMessage({
        channel: userToNotify,
        unfurl_links: false,
        unfurl_media: false,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${icon} Updated Pull Request for ${event_payload.issue_id} ${icon}`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `*${priority}*  | <${event_payload.pr_url}|See Pull Request> or <${issueUrlPrefix}${event_payload.issue_id}|See Issue>`
              }
            ]
          },
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: notificationMessage
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  emoji: true,
                  text: 'View Code Review Thread'
                },
                action_id: 'view_code_review_thread',
                style: 'primary',
                url: permalink
              }
            ]
          }
        ],
        text: notificationMessage
      })

      if (!postNotification.ok) {
        console.log('Error during request chat.postMessage!', postNotification)
      }
    })
}

function getIcon(action_id: string, mark = '') {
  if (action_id === 'subscribe') return ':love_letter:'
  if (action_id === 'unsubscribe') return ':wave:'
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
  if (action_id === 'unapprove') {
    return `<@${currentUserId}> Re-Opened (Unapproved) the Pull Request for ${event_payload.issue_id}.`
  }

  if (action_id === 'approve') {
    return `<@${currentUserId}> Approved the Pull Request for ${event_payload.issue_id}.`
  }

  if (action_id === 'undecline') {
    return `<@${currentUserId}> Re-Opened (Un-Declined) the Pull Request for ${event_payload.issue_id}.`
  }

  if (action_id === 'decline') {
    return `<@${currentUserId}> Declined the Pull Request for ${event_payload.issue_id}.`
  }

  if (action_id === 'claim') {
    return `<@${currentUserId}> Claimed the Pull Request for ${event_payload.issue_id}.`
  }

  if (action_id === 'unclaim') {
    return `<@${currentUserId}> Unclaimed the Pull Request for ${event_payload.issue_id}.`
  }

  if (action_id === 'mark') {
    return `<@${currentUserId}> Marked the Pull Request as '${event_payload.mark}' for ${event_payload.issue_id}.`
  }

  if (action_id === 'unmark') {
    return `<@${currentUserId}> Unmarked the Pull Request for ${event_payload.issue_id}.`
  }

  if (action_id === 'edit') {
    return `<@${currentUserId}> Edited the Pull Request Review for ${event_payload.issue_id}.`
  }

  if (action_id === 'subscribe') {
    return `You've Subscribed to the Pull Request Review for ${event_payload.issue_id}. Welcome to the party!`
  }

  if (action_id === 'unsubscribe') {
    return `You've Unsubscribed to the Pull Request Review for ${event_payload.issue_id}. Goodbye!`
  }
}

async function getPermalink(client: SlackAPIClient, channelId: string, timestamp: string) {
  const permalink = await client.chat.getPermalink({
    channel: channelId,
    message_ts: timestamp
  })

  if (!permalink.ok) {
    console.log('Error during request chat.getPermalink!', permalink)
    return undefined
  } else {
    return permalink.permalink as string
  }
}
