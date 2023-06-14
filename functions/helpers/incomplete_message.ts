import { SlackAPIClient } from 'deno-slack-api/types.ts'
import { BlockElement } from 'deno-slack-sdk/functions/interactivity/block_kit_types.ts'
import { OldestCodeReviewDatastore } from '../../datastores/oldest_code_review_datastore.ts'
import { ListIncompleteReviewsEvent } from '../../event_types/list_incomplete_reviews_event.ts'
import { ISSUE_URL_PREFIX } from './constants.ts'
import { getCodeReviewIcon, getCodeReviewState } from './review_message.ts'
import { createCodeReviewMetadata } from './review_metadata.ts'

interface HistoryMessage {
  blocks: BlockElement[]
  metadata: {
    event_type: string
    event_payload: ReturnType<typeof createCodeReviewMetadata>['event_payload']
  }
  ts: string
  type: string
  channel: string
  permalink: string
  [key: string]: unknown
}

export async function listIncompleteReviews(
  client: SlackAPIClient,
  userId: string,
  channelId: string,
  sendMessage = true
) {
  const channelName = await getChannelName(client, channelId)
  const timestamp = await getOldestReview(client, channelId)
  const allBotMessages = await getCodeReviews(client, channelId, timestamp)
  const incompleteReviews = await addPermaLinks(
    client,
    channelId,
    allBotMessages.filter((botMessage) => botMessage?.blocks?.some((block: BlockElement) => block?.type === 'actions'))
  )

  const metadata = {
    event_type: ListIncompleteReviewsEvent,
    event_payload: {
      count: incompleteReviews.length,
      reviews: incompleteReviews.map((botMessage) => botMessage.ts)
    }
  }

  if (!sendMessage) return metadata.event_payload

  const postIncompleteReviews = await client.chat.postEphemeral({
    channel: channelId,
    user: userId,
    username: 'Incomplete Reviews',
    icon_url: 'https://raw.githubusercontent.com/pcbowers/pr-bot/main/assets/icon.png',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${incompleteReviews.length} Incomplete PR Code Review${incompleteReviews.length === 1 ? '' : 's'}`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `This includes all the incomplete PR Code Reviews from <#${channelId}>.`
          }
        ]
      },
      ...incompleteReviews.map(createReviewMessageBlock),
      ...(incompleteReviews.length === 0
        ? [{ type: 'section', text: { type: 'plain_text', text: 'Look at you go! :thumbsup:' } }]
        : [])
      // ,{
      //   type: 'actions',
      //   elements: [
      //     {
      //       type: 'button',
      //       text: {
      //         type: 'plain_text',
      //         text: 'Refresh List',
      //         emoji: true
      //       },
      //       style: 'primary',
      //       action_id: 'refresh_incomplete_reviews'
      //     },
      //     {
      //       type: 'button',
      //       text: {
      //         type: 'plain_text',
      //         text: 'Delete List',
      //         emoji: true
      //       },
      //       style: 'danger',
      //       action_id: 'delete_incomplete_reviews'
      //     }
      //   ]
      // }
    ],
    text: `There ${incompleteReviews.length === 1 ? 'is' : 'are'} currently ${
      incompleteReviews.length
    } Incomplete PR Code Review${incompleteReviews.length === 1 ? '' : 's'}${
      channelName ? ` in \`#${channelName}\`` : ''
    }`
  })

  if (!postIncompleteReviews.ok) {
    console.log('Error during request chat.postMessage!', postIncompleteReviews)
  }

  return metadata.event_payload
}

function createReviewMessageBlock(botMessage: HistoryMessage) {
  const date = new Date(Number(botMessage.ts) * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  })

  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `${getCodeReviewIcon(
        getCodeReviewState(botMessage.metadata.event_payload),
        botMessage.metadata.event_payload.mark
      )} ${date}: <${botMessage.metadata.event_payload.pr_url}|PR> for <${ISSUE_URL_PREFIX}${
        botMessage.metadata.event_payload.issue_id
      }|${botMessage.metadata.event_payload?.issue_id}> by *<@${botMessage.metadata.event_payload.author}>*`
    },
    accessory: {
      type: 'button',
      text: {
        type: 'plain_text',
        text: 'View Code Review',
        emoji: true
      },
      url: botMessage.permalink,
      action_id: 'view_code_review_thread'
    }
  }
}

async function getCodeReviews(client: SlackAPIClient, channel: string, oldestTimestamp = '0', cursor?: string) {
  const botMessages: HistoryMessage[] = []

  do {
    const msgSearch = await client.conversations.history({
      channel: channel,
      include_all_metadata: true,
      oldest: oldestTimestamp,
      inclusive: true,
      limit: 200,
      ...(cursor ? { cursor } : {})
    })

    if (!msgSearch.ok) {
      console.log('Error during request search.messages!', msgSearch)
      break
    }

    const newBotMessages = msgSearch.messages.filter(
      (message: HistoryMessage) =>
        message?.metadata?.event_type === 'code_review_event' && message?.metadata?.event_payload !== undefined
    )

    botMessages.push(...newBotMessages)

    if (msgSearch.has_more) {
      cursor = msgSearch?.response_metadata?.next_cursor
    } else {
      cursor = undefined
      if (botMessages.length) await updateOldestReview(client, channel, botMessages[botMessages.length - 1].ts)
    }
  } while (cursor !== undefined)

  return botMessages
}

async function addPermaLinks(client: SlackAPIClient, channel: string, botMessages: HistoryMessage[]) {
  return await Promise.all(
    botMessages.map(async (botMessage) => {
      const permalink = await client.chat.getPermalink({
        channel: channel,
        message_ts: botMessage.ts
      })

      if (!permalink.ok) {
        console.log('Error during request chat.getPermalink!', permalink)
        botMessage.channel = permalink.channel
      } else {
        botMessage.channel = permalink.channel
        botMessage.permalink = permalink.permalink
      }

      return botMessage
    })
  )
}

async function getChannelName(client: SlackAPIClient, channel: string) {
  const channelInfo = await client.conversations.info({
    channel: channel
  })

  if (!channelInfo.ok) {
    console.log('Error during request conversations.info!', channelInfo)
    return undefined
  }

  return channelInfo?.channel?.name
}

async function getOldestReview(client: SlackAPIClient, channel: string) {
  const oldestReview = await client.apps.datastore.get<typeof OldestCodeReviewDatastore.definition>({
    datastore: 'code_review_datastore',
    id: 'oldest_review_' + channel
  })

  if (!oldestReview.ok) {
    console.log('Error during request apps.datastore.get!', oldestReview)
    return '0'
  }

  return oldestReview?.item?.timestamp ?? '0'
}

async function updateOldestReview(client: SlackAPIClient, channel: string, timestamp: string) {
  const updateOldestIncompleteReview = await client.apps.datastore.update<typeof OldestCodeReviewDatastore.definition>({
    datastore: 'code_review_datastore',
    item: {
      id: 'oldest_review_' + channel,
      timestamp: timestamp
    }
  })

  if (!updateOldestIncompleteReview.ok) {
    console.log('Error during request apps.datastore.put!', updateOldestIncompleteReview)
  }
}
