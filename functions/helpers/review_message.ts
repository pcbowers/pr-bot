import { WorkflowStepInputs } from 'deno-slack-sdk/workflows/types.ts'
import { CodeReviewFunction } from '../code_review_function.ts'
import { createCodeReviewMetadata } from './review_metadata.ts'
import { ISSUE_URL_PREFIX } from './constants.ts'
type EventPayload = Partial<ReturnType<typeof createCodeReviewMetadata>['event_payload']>

type CodeReviewInputParameters = WorkflowStepInputs<
  NonNullable<typeof CodeReviewFunction.definition.input_parameters>['properties'],
  NonNullable<typeof CodeReviewFunction.definition.input_parameters>['required']
>

interface ButtonData {
  title: string
  action_id: string
  style?: 'primary' | 'danger'
}

type State = 'authored' | 'claimed' | 'marked' | 'approved' | 'declined'

export function createCodeReviewMessage(event_payload: EventPayload, complete: boolean) {
  const state = getCodeReviewState(event_payload)
  const priority = getCodeReviewPriority(event_payload.priority, true)
  const logs = getLogs(event_payload)
  const buttons = getButtons(state, complete)

  return [
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${priority} <${event_payload.pr_url}|See Pull Request> for <${ISSUE_URL_PREFIX}${event_payload.issue_id}|${event_payload.issue_id}> by <@${event_payload.author}>${logs}`
        }
      ]
    },
    ...(event_payload.pr_description && event_payload.pr_description !== '!undefined!'
      ? [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: event_payload.pr_description
            }
          }
        ]
      : []),
    ...(buttons.length
      ? [
          {
            type: 'actions',
            elements: buttons
          }
        ]
      : [])
  ]
}

export function getCodeReviewPriority(priority: CodeReviewInputParameters['priority'], short = false) {
  if (priority === 'low') return short ? '⚪️' : '⚪️ Low Priority (Not Urgent)'
  if (priority === 'medium') return short ? '🔵' : '🔵 Medium Priority (Timely)'
  if (priority === 'high') return short ? '🔴' : '🔴 High Priority (Urgent)'
  return short ? '🔵' : '🔵 Medium Priority (Timely)'
}

export function getCodeReviewState(event_payload: EventPayload): State {
  if (event_payload.approver) return 'approved'
  if (event_payload.decliner) return 'declined'
  if (event_payload.marker) return 'marked'
  if (event_payload.claimer) return 'claimed'
  return 'authored'
}

export function getCodeReviewIcon(state: State, mark = '') {
  if (state === 'authored') return ':tada:'
  if (state === 'claimed') return ':eyes:'
  if (state === 'approved') return ':white_check_mark:'
  if (state === 'declined') return ':no_entry_sign:'
  if (state === 'marked') {
    if (mark === 'Needs Work') return ':construction:'
  }
  return ':tada:'
}

function getLogs(event_payload: EventPayload) {
  const text = []
  if (event_payload.claimer) {
    text.push(`_👀 by *<@${event_payload.claimer}>*_`)
  }

  if (event_payload.marker) {
    text.push(
      `_${getCodeReviewIcon(getCodeReviewState(event_payload), event_payload.mark)} by *<@${event_payload.marker}>*_`
    )
  }

  if (event_payload.approver) {
    text.push(`_${getCodeReviewIcon(getCodeReviewState(event_payload))} by *<@${event_payload.approver}>*_`)
  }

  if (event_payload.decliner) {
    text.push(`_${getCodeReviewIcon(getCodeReviewState(event_payload))} by *<@${event_payload.decliner}>*_`)
  }

  return text.length ? '\n' + text.join(', ') : ''
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
      createButton({ title: 'Mark', action_id: 'mark' }),
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

  if (state === 'marked') {
    return [
      createButton({ title: 'Remove Mark', action_id: 'unmark' }),
      createButton({
        title: 'Complete',
        action_id: 'complete',
        style: 'primary'
      }),
      ...baseButtons
    ]
  }

  if (state === 'approved') {
    return [
      createButton({ title: 'Re-Open', action_id: 'unapprove' }),
      createButton({
        title: 'Complete',
        action_id: 'complete',
        style: 'primary'
      }),
      ...baseButtons
    ]
  }

  if (state === 'declined') {
    return [
      createButton({ title: 'Re-Open', action_id: 'undecline' }),
      createButton({
        title: 'Complete',
        action_id: 'complete',
        style: 'primary'
      }),
      ...baseButtons
    ]
  }

  return baseButtons
}

export function createButton(buttonData: ButtonData) {
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
          text: 'Edit PR Review'
        },
        value: 'edit'
      },
      {
        text: {
          type: 'plain_text',
          text: 'Complete PR Review'
        },
        value: 'complete'
      },
      {
        text: {
          type: 'plain_text',
          text: 'Delete PR Review'
        },
        value: 'delete'
      }
    ],
    action_id: 'overflow'
  }
}
