import { createCodeReviewMetadata } from './review_metadata.ts'

export function codeReviewMarkModal(metadata: ReturnType<typeof createCodeReviewMetadata>) {
  return {
    type: 'modal',
    callback_id: 'mark_modal',
    private_metadata: JSON.stringify(metadata.event_payload),
    title: {
      type: 'plain_text',
      text: 'Add Mark to Review',
      emoji: true
    },
    submit: {
      type: 'plain_text',
      text: 'Add Mark',
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
        block_id: 'mark_section',
        element: {
          type: 'static_select',
          placeholder: {
            type: 'plain_text',
            text: 'Select a Mark',
            emoji: true
          },
          options: [
            {
              text: {
                type: 'plain_text',
                text: ':construction: Needs Work',
                emoji: true
              },
              value: 'Needs Work'
            }
          ],
          action_id: 'mark'
        },
        label: {
          type: 'plain_text',
          text: 'Mark',
          emoji: true
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'plain_text',
            text: 'A status that will be added to the review in lieu of approving or declining',
            emoji: true
          }
        ]
      }
    ]
  }
}
