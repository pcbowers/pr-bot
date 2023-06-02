import { WorkflowStepInputs } from 'deno-slack-sdk/workflows/types.ts'
import { CodeReviewEvent } from '../event_types/code_review_event.ts'
import { CodeReviewFunction } from './code_review_function.ts'

type EventPayload = Partial<{
  [P in keyof typeof CodeReviewEvent.definition.properties]: string
}>

type CodeReviewInputParameters = WorkflowStepInputs<
  NonNullable<typeof CodeReviewFunction.definition.input_parameters>['properties'],
  NonNullable<typeof CodeReviewFunction.definition.input_parameters>['required']
>

interface ButtonData {
  title: string
  action_id: string
  style?: 'primary' | 'danger'
}

type State = 'authored' | 'claimed' | 'approved' | 'declined'

export const ISSUE_URL_PREFIX = 'https://jira.os.liberty.edu/browse/'

export function createCodeReviewMessage(event_payload: EventPayload, complete: boolean) {
  const state = getCodeReviewState(event_payload)
  const priority = getCodeReviewPriority(event_payload.priority)
  const icon = getCodeReviewIcon(state)
  const logs = getLogs(event_payload)
  const buttons = getButtons(state, complete)

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${icon} Pull Request for ${event_payload.issue_id} ${icon}`
      }
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*${priority}*  | <${event_payload.pr_url}|See Pull Request> or <${ISSUE_URL_PREFIX}${event_payload.issue_id}|See Issue>`
        }
      ]
    },
    ...(event_payload.pr_description && event_payload.pr_description !== '!undefined!'
      ? [
          {
            type: 'divider'
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: event_payload.pr_description
            }
          }
        ]
      : []),
    ...logs,
    ...(buttons.length
      ? [
          {
            type: 'divider'
          },
          {
            type: 'actions',
            elements: buttons
          }
        ]
      : [])
  ]
}

export function getCodeReviewPriority(priority: CodeReviewInputParameters['priority']) {
  if (priority === 'low') return '⚪️ Low Priority (Not Urgent)'
  if (priority === 'medium') return '🔵 Medium Priority (Timely)'
  if (priority === 'high') return '🔴 High Priority (Urgent)'
  return '🔵 Medium Priority (Timely)'
}

export function getCodeReviewState(event_payload: EventPayload): State {
  if (event_payload.approver) return 'approved'
  if (event_payload.decliner) return 'declined'
  if (event_payload.claimer) return 'claimed'
  return 'authored'
}

export function getCodeReviewIcon(state: string) {
  if (state === 'authored') return ':tada:'
  if (state === 'claimed') return ':eyes:'
  if (state === 'approved') return ':white_check_mark:'
  if (state === 'declined') return ':no_entry_sign:'
  return ':tada:'
}

function getLogs(event_payload: EventPayload) {
  const text = [`_Authored By: *<@${event_payload.author}>*_`]

  if (event_payload.claimer) {
    text.push(`_Claimed By: *<@${event_payload.claimer}>*_`)
  }

  if (event_payload.approver) {
    text.push(`_Approved By: *<@${event_payload.approver}>*_`)
  }

  if (event_payload.decliner) {
    text.push(`_Declined By: *<@${event_payload.decliner}>*_`)
  }

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: text.join('\n')
      }
    }
  ]
}

function getButtons(state: State, complete: boolean) {
  if (complete) return []

  const baseButtons = [createOverflow()]

  if (state === 'authored') {
    return [createButton({ title: 'Claim', action_id: 'claim', style: 'primary' }), ...baseButtons]
  }

  if (state === 'claimed') {
    return [
      createButton({ title: 'Remove Claim', action_id: 'unclaim' }),
      createButton({
        title: 'Approve',
        action_id: 'approve',
        style: 'primary'
      }),
      createButton({
        title: 'Decline',
        action_id: 'decline',
        style: 'danger'
      }),
      ...baseButtons
    ]
  }

  if (state === 'approved') {
    return [createButton({ title: 'Re-Open', action_id: 'unapprove' }), ...baseButtons]
  }

  if (state === 'declined') {
    return [createButton({ title: 'Re-Open', action_id: 'undecline' }), ...baseButtons]
  }

  return baseButtons
}

function createButton(buttonData: ButtonData) {
  return {
    type: 'button',
    text: {
      type: 'plain_text',
      emoji: true,
      text: buttonData.title
    },
    ...(buttonData.style ? { style: buttonData.style } : {}),
    action_id: buttonData.action_id
  }
}

function createOverflow() {
  return {
    type: 'overflow',
    options: [
      {
        text: {
          type: 'plain_text',
          text: 'List Incomplete Reviews'
        },
        value: 'list_incomplete_reviews'
      },
      {
        text: {
          type: 'plain_text',
          text: 'Edit'
        },
        value: 'edit'
      },
      {
        text: {
          type: 'plain_text',
          text: 'Complete'
        },
        value: 'complete'
      },
      {
        text: {
          type: 'plain_text',
          text: 'Delete'
        },
        value: 'delete'
      }
    ],
    action_id: 'overflow'
  }
}
