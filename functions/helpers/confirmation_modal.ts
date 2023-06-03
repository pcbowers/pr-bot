import { CodeReviewEvent } from '../../event_types/code_review_event.ts'

type EventPayload = Partial<{
  [P in keyof typeof CodeReviewEvent.definition.properties]: string
}>

export function codeReviewConfirmModal(event_payload: EventPayload, modalText: string, callback_id: string) {
  return {
    type: 'modal',
    callback_id: callback_id,
    clear_on_close: true,
    private_metadata: JSON.stringify(event_payload),
    title: {
      type: 'plain_text',
      text: 'Are You Sure?',
      emoji: true
    },
    submit: {
      type: 'plain_text',
      text: 'Continue',
      emoji: true
    },
    close: {
      type: 'plain_text',
      text: 'Take Me Back',
      emoji: true
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: modalText
        }
      }
    ]
  }
}
