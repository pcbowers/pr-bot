import { getCodeReviewPriority } from './review_message.ts'
import { createCodeReviewMetadata } from './review_metadata.ts'

export function codeReviewEditModal(metadata: ReturnType<typeof createCodeReviewMetadata>) {
  return {
    type: 'modal',
    callback_id: 'edit_modal',
    private_metadata: JSON.stringify(metadata.event_payload),
    title: {
      type: 'plain_text',
      text: 'Edit Pull Request',
      emoji: true
    },
    submit: {
      type: 'plain_text',
      text: 'Finish Editing',
      emoji: true
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
      emoji: true
    },
    blocks: [
      {
        type: 'input',
        block_id: 'priority_section',
        element: {
          type: 'static_select',
          options: [
            {
              text: {
                type: 'plain_text',
                text: '⚪️ Low Priority (Not Urgent)',
                emoji: true
              },
              value: 'low'
            },
            {
              text: {
                type: 'plain_text',
                text: '🔵 Medium Priority (Timely)',
                emoji: true
              },
              value: 'medium'
            },
            {
              text: {
                type: 'plain_text',
                text: '🔴 High Priority (Urgent)',
                emoji: true
              },
              value: 'high'
            }
          ],
          action_id: 'priority',
          initial_option: {
            text: {
              type: 'plain_text',
              text: getCodeReviewPriority(metadata.event_payload.priority),
              emoji: true
            },
            value: metadata.event_payload.priority
          }
        },
        label: {
          type: 'plain_text',
          text: 'Priority',
          emoji: true
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'plain_text',
            text: 'The urgency of your Pull Request, helps indicate time sensitivity.',
            emoji: true
          }
        ]
      },
      {
        type: 'input',
        block_id: 'pr_title_section',
        element: {
          type: 'plain_text_input',
          action_id: 'pr_title',
          initial_value: metadata.event_payload.pr_title
        },
        label: {
          type: 'plain_text',
          text: 'Pull Request Title',
          emoji: true
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'plain_text',
            text: 'The Title of the Pull Request. Issue IDs will automatically be hyperlinked.',
            emoji: true
          }
        ]
      },
      {
        type: 'input',
        block_id: 'pr_url_section',
        element: {
          type: 'url_text_input',
          action_id: 'pr_url',
          ...(isValidHttpUrl(metadata.event_payload.pr_url) ? { initial_value: metadata.event_payload.pr_url } : {})
        },
        label: {
          type: 'plain_text',
          text: 'Pull Request URL',
          emoji: true
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'plain_text',
            text: 'The URL that navigates to the Pull Request.',
            emoji: true
          }
        ]
      },
      {
        type: 'input',
        block_id: 'pr_description_section',
        optional: true,
        element: {
          type: 'plain_text_input',
          multiline: true,
          action_id: 'pr_description',
          ...(metadata.event_payload.pr_description && metadata.event_payload.pr_description !== '!undefined!'
            ? { initial_value: metadata.event_payload.pr_description }
            : {})
        },
        label: {
          type: 'plain_text',
          text: 'Pull Request Description',
          emoji: true
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'plain_text',
            text: 'A description that will be posted with your Pull Request. Supports Slack Markdown.',
            emoji: true
          }
        ]
      }
    ]
  }
}

function isValidHttpUrl(potentialUrl: string) {
  try {
    const url = new URL(potentialUrl)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch (_error) {
    return false
  }
}
