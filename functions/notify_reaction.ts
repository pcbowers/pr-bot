import type { SlackAPIClient } from 'deno-slack-api/types.ts'
import CodeReviewEvent from '../event_types/code_review_event.ts'
import { getPriority } from './create_message.ts'

interface Reaction {
  name: string
  users: string[]
  count: number
}

interface Message {
  reactions: Reaction[]
  type: string
  user: string
  ts: string
  team: string
  permalink: string
}

type EventPayload = Partial<{
  [P in keyof typeof CodeReviewEvent.definition.properties]: string
}>

export default async function notifyReactionUsers(
  client: SlackAPIClient,
  channel: string,
  timestamp: string,
  currentUserId: string,
  action_id: string,
  event_payload: EventPayload
) {
  if (
    !['edit', 'unclaim', 'claim', 'unapprove', 'approve'].includes(action_id)
  ) {
    return
  }

  const reactions = await client.reactions.get({
    channel,
    timestamp,
    full: true
  })

  if (!reactions.ok) {
    return console.log('Error during request reactions.get!', reactions)
  }

  const message = reactions.message as Message
  const icon = getIcon(action_id)
  const priority = getPriority(event_payload.priority)
  const issueUrlPrefix = 'https://jira.os.liberty.edu/browse/'
  const notificationMessage = getNotificationMessage(
    action_id,
    event_payload,
    currentUserId
  )

  return (
    [
      ...new Set(
        (message.reactions || []).map((reaction) => reaction.users).flat()
      )
    ]
      // .filter((userId) => userId !== currentUserId)
      .forEach(async (userId) => {
        const postNotification = await client.chat.postMessage({
          channel: userId,
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
                  url: message.permalink
                }
              ]
            }
          ],
          text: notificationMessage
        })

        if (!postNotification.ok) {
          console.log(
            'Error during request chat.postMessage!',
            postNotification
          )
        }
      })
  )
}

function getIcon(action_id: string) {
  if (action_id === 'unapprove') return ':no_entry_sign:'
  if (action_id === 'approve') return ':white_check_mark:'
  if (action_id === 'claim') return ':eyes:'
  if (action_id === 'unclaim') return ':dark_sunglasses:'
  if (action_id === 'edit') return ':pencil2:'
  return ':tada:'
}

function getNotificationMessage(
  action_id: string,
  event_payload: EventPayload,
  currentUserId: string
) {
  if (action_id === 'unapprove') {
    return `<@${currentUserId}> Unapproved the Pull Request for ${event_payload.issue_id}.`
  }

  if (action_id === 'approve') {
    return `<@${currentUserId}> Approved the Pull Request for ${event_payload.issue_id}.`
  }

  if (action_id === 'claim') {
    return `<@${currentUserId}> Claimed the Pull Request for ${event_payload.issue_id}.`
  }

  if (action_id === 'unclaim') {
    return `<@${currentUserId}> Unclaimed the Pull Request for ${event_payload.issue_id}.`
  }

  if (action_id === 'edit') {
    return `<@${currentUserId}> Edited the Pull Request Review for ${event_payload.issue_id}.`
  }
}
