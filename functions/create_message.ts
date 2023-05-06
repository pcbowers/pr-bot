import { WorkflowStepInputs } from 'deno-slack-sdk/workflows/types.ts'
import { CodeReviewFunction } from './code_review_function.ts'
import CodeReviewEvent from '../event_types/code_review_event.ts'

type EventPayload = Partial<{
  [P in keyof typeof CodeReviewEvent.definition.properties]: string
}>

type State = {
  type: 'authored' | 'claimed' | 'approved'
  event_payload: EventPayload
  complete: boolean
}

type CodeReviewInputParameters = WorkflowStepInputs<
  NonNullable<
    typeof CodeReviewFunction.definition.input_parameters
  >['properties'],
  NonNullable<typeof CodeReviewFunction.definition.input_parameters>['required']
>

interface ConfirmDialogData {
  title: string
  text: string
  confirm: string
  deny: string
}

interface ButtonData {
  title: string
  action_id: string
  style?: 'primary' | 'danger'
}

export default function createMessage(state: State) {
  const priority = getPriority(state.event_payload.priority)
  const icon = getIcon(state)
  const logs = getLogs(state)
  const buttons = getButtons(state)
  const issueUrlPrefix = 'https://jira.os.liberty.edu/browse/'

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${icon} Pull Request for ${state.event_payload.issue_id} ${icon}`
      }
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*${priority}*  | <${state.event_payload.pr_url}|See Pull Request> or <${issueUrlPrefix}${state.event_payload.issue_id}|See Issue>`
        }
      ]
    },
    ...(state.event_payload.pr_description &&
    state.event_payload.pr_description !== '!undefined!'
      ? [
          {
            type: 'divider'
          },
          // TODO: Once old PRs are cleaned up, only use the string version
          ...(typeof state.event_payload.pr_description === 'string'
            ? [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: state.event_payload.pr_description
                  }
                }
              ]
            : (state.event_payload.pr_description as unknown as any[]))
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

export function getPriority(priority: CodeReviewInputParameters['priority']) {
  if (priority === 'low') return '⚪️ Low Priority (Not Urgent)'
  if (priority === 'medium') return '🔵 Medium Priority (Timely)'
  if (priority === 'high') return '🔴 High Priority (Urgent)'
  return '🔵 Medium Priority (Timely)'
}

function getIcon(state: State) {
  if (state.type === 'authored') return ':tada:'
  if (state.type === 'claimed') return ':eyes:'
  if (state.type === 'approved') return ':white_check_mark:'
  return ':tada:'
}

function getLogs(state: State) {
  const text = [`_Authored By: *<@${state.event_payload.author}>*_`]

  if (state.event_payload.claimer) {
    text.push(`_Claimed By: *<@${state.event_payload.claimer}>*_`)
  }

  if (state.event_payload.approver) {
    text.push(`_Approved By: *<@${state.event_payload.approver}>*_`)
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

function createConfirmDialog(confirmDialogData: ConfirmDialogData) {
  return {
    title: {
      type: 'plain_text',
      text: confirmDialogData.title
    },
    text: {
      type: 'mrkdwn',
      text: confirmDialogData.text
    },
    confirm: {
      type: 'plain_text',
      text: confirmDialogData.confirm
    },
    deny: {
      type: 'plain_text',
      text: confirmDialogData.deny
    },
    style: 'danger'
  }
}

function createButton(
  buttonData: ButtonData,
  confirmDialogData?: ConfirmDialogData
) {
  return {
    type: 'button',
    text: {
      type: 'plain_text',
      emoji: true,
      text: buttonData.title
    },
    ...(confirmDialogData
      ? { confirm: createConfirmDialog(confirmDialogData) }
      : {}),
    ...(buttonData.style ? { style: buttonData.style } : {}),
    action_id: buttonData.action_id
  }
}

function getButtons(state: State) {
  if (state.complete) return []

  const baseButtons = [
    createButton(
      {
        title: 'Complete',
        action_id: 'complete',
        style: state.event_payload.approver ? 'primary' : undefined
      },
      {
        title: 'Are you sure?',
        text: 'By marking this as complete, you will no longer be able to change the claim/approval status and make other edits. Are you sure you want to do this?',
        deny: "Stop, I've changed my mind!",
        confirm: 'Do it'
      }
    ),
    createButton({
      title: 'Edit',
      action_id: 'edit',
      style: 'primary'
    }),
    createButton(
      {
        title: 'Delete',
        action_id: 'delete',
        style: 'danger'
      },
      {
        title: 'Are you sure?',
        text: 'Once deleted, you will not be able to recover this message. Are you sure you want to do this?',
        deny: "Stop, I've changed my mind!",
        confirm: 'Do it'
      }
    )
  ]

  if (state.type === 'authored') {
    return [
      createButton({ title: 'Claim', action_id: 'claim', style: 'primary' }),
      createButton({ title: 'Approve', action_id: 'approve' }),
      ...baseButtons
    ]
  }

  if (state.type === 'claimed') {
    return [
      createButton({ title: 'Remove Claim', action_id: 'unclaim' }),
      createButton({
        title: 'Approve',
        action_id: 'approve',
        style: 'primary'
      }),
      ...baseButtons
    ]
  }

  if (state.type === 'approved' && !state.event_payload.claimer) {
    return [
      createButton({ title: 'Claim', action_id: 'claim' }),
      createButton({ title: 'Remove Approval', action_id: 'unapprove' }),
      ...baseButtons
    ]
  }

  if (state.type === 'approved' && state.event_payload.claimer) {
    return [
      createButton({ title: 'Remove Claim', action_id: 'unclaim' }),
      createButton({ title: 'Remove Approval', action_id: 'unapprove' }),
      ...baseButtons
    ]
  }

  return baseButtons
}
