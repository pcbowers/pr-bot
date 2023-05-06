import { DefineFunction, Schema, SlackFunction } from 'deno-slack-sdk/mod.ts'
import CodeReviewEvent from '../event_types/code_review_event.ts'
import createMessage, { getPriority } from './create_message.ts'

export const CodeReviewFunction = DefineFunction({
  callback_id: 'code_review_function',
  title: 'Create and Manage a Pull Request Code Review Message',
  source_file: 'functions/code_review_function.ts',
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      channel: { type: Schema.slack.types.channel_id },
      priority: { type: Schema.types.string },
      issue_id: { type: Schema.types.string },
      pr_url: { type: Schema.types.string },
      pr_description: { type: Schema.types.string }
    },
    required: ['interactivity', 'channel', 'priority', 'issue_id', 'pr_url']
  },
  output_parameters: {
    properties: {
      type: { type: Schema.types.string },
      channel_id: { type: Schema.slack.types.channel_id },
      message_ts: { type: Schema.slack.types.message_ts },
      author: { type: Schema.slack.types.user_id },
      claimer: { type: Schema.slack.types.user_id },
      approver: { type: Schema.slack.types.user_id },
      priority: { type: Schema.types.string },
      issue_id: { type: Schema.types.string },
      pr_url: { type: Schema.types.string },
      pr_description: { type: Schema.types.string }
    },
    required: ['author', 'channel_id', 'priority', 'issue_id', 'pr_url']
  }
})

export default SlackFunction(CodeReviewFunction, async ({ inputs, client }) => {
  const metadata = {
    event_type: CodeReviewEvent,
    event_payload: {
      channel_id: inputs.channel,
      author: inputs.interactivity.interactor.id,
      priority: inputs.priority,
      issue_id: inputs.issue_id,
      pr_url: inputs.pr_url,
      pr_description: inputs.pr_description
    }
  }

  const msgResponse = await client.chat.postMessage({
    channel: inputs.channel,
    blocks: createMessage({
      type: 'authored',
      event_payload: metadata.event_payload,
      complete: false
    }),
    unfurl_links: false,
    unfurl_media: false,
    username: 'Pull Request',
    icon_url:
      'https://raw.githubusercontent.com/pcbowers/pr-bot/main/assets/icon.png',
    text: 'A new Pull Request is ready for Code Review!',
    metadata
  })

  if (!msgResponse.ok) {
    console.log('Error during request chat.postMessage!', msgResponse)
  }

  return { completed: false }
})
  .addBlockActionsHandler(
    ['claim', 'unclaim', 'approve', 'unapprove', 'complete'],
    async ({ action, inputs, body, client }) => {
      const metadata = {
        event_type: CodeReviewEvent,
        event_payload: {
          channel_id: body.container.channel_id ?? inputs.channel,
          message_ts: body.container.message_ts,
          author: body.message?.metadata?.event_payload?.author,
          claimer:
            action.action_id === 'unclaim'
              ? undefined
              : action.action_id === 'claim'
              ? body.user.id
              : body.message?.metadata?.event_payload?.claimer,
          approver:
            action.action_id === 'unapprove'
              ? undefined
              : action.action_id === 'approve'
              ? body.user.id
              : body.message?.metadata?.event_payload?.approver,
          priority:
            body.message?.metadata?.event_payload?.priority ?? inputs.priority,
          issue_id:
            body.message?.metadata?.event_payload?.issue_id ?? inputs.issue_id,
          pr_url:
            body.message?.metadata?.event_payload?.pr_url ?? inputs.pr_url,
          pr_description:
            body.message?.metadata?.event_payload?.pr_description ??
            inputs.pr_description
        }
      }

      const msgResponse = await client.chat.update({
        channel: body.container.channel_id,
        ts: body.container.message_ts,
        blocks: createMessage({
          type: metadata.event_payload.approver
            ? 'approved'
            : metadata.event_payload.claimer
            ? 'claimed'
            : 'authored',
          event_payload: metadata.event_payload,
          complete: action.action_id === 'complete' ? true : false
        }),
        metadata
      })

      if (!msgResponse.ok) {
        console.log('Error during request chat.update!', msgResponse)
      }

      if (action.action_id === 'complete') {
        return await client.functions.completeSuccess({
          function_execution_id: body.container.function_execution_id,
          outputs: {
            type: 'complete',
            channel_id: body.container.channel_id,
            message_ts: body.container.message_ts,
            author: body.message?.metadata?.event_payload?.author,
            claimer: body.message?.metadata?.event_payload?.claimer,
            approver: body.message?.metadata?.event_payload?.approver,
            priority: metadata.event_payload.priority,
            issue_id: metadata.event_payload.issue_id,
            pr_url: metadata.event_payload.pr_url,
            pr_description: metadata.event_payload.pr_description
          }
        })
      }

      return { completed: false }
    }
  )
  .addBlockActionsHandler(['delete'], async ({ body, client, inputs }) => {
    const msgResponse = await client.chat.delete({
      channel: body.container.channel_id,
      ts: body.container.message_ts
    })

    if (!msgResponse.ok) {
      console.log('Error during request chat.delete!', msgResponse)
    }

    return await client.functions.completeSuccess({
      function_execution_id: body.container.function_execution_id,
      outputs: {
        type: 'delete',
        channel_id: body.container.channel_id,
        author: body.message?.metadata?.event_payload?.author,
        claimer: body.message?.metadata?.event_payload?.claimer,
        approver: body.message?.metadata?.event_payload?.approver,
        priority:
          body.message?.metadata?.event_payload?.priority ?? inputs.priority,
        issue_id:
          body.message?.metadata?.event_payload?.issue_id ?? inputs.issue_id,
        pr_url: body.message?.metadata?.event_payload?.pr_url ?? inputs.pr_url,
        pr_description:
          body.message?.metadata?.event_payload?.pr_description ??
          inputs.pr_description
      }
    })
  })
  .addBlockActionsHandler(['edit'], async ({ body, client, inputs }) => {
    const currentInputs = {
      priority:
        body.message?.metadata?.event_payload?.priority ?? inputs.priority,
      issue_id:
        body.message?.metadata?.event_payload?.issue_id ?? inputs.issue_id,
      pr_url: body.message?.metadata?.event_payload?.pr_url ?? inputs.pr_url,
      pr_description:
        body.message?.metadata?.event_payload?.pr_description ??
        inputs.pr_description
    }

    const viewResponse = await client.views.open({
      trigger_id: body.interactivity.interactivity_pointer,
      view: {
        type: 'modal',
        callback_id: 'edit_modal',
        private_metadata: JSON.stringify({
          channel_id: body.container.channel_id,
          message_ts: body.container.message_ts,
          author: body.message?.metadata?.event_payload?.author,
          claimer: body.message?.metadata?.event_payload?.claimer,
          approver: body.message?.metadata?.event_payload?.approver
        }),
        title: {
          type: 'plain_text',
          text: 'Edit Pull Request',
          emoji: true
        },
        submit: {
          type: 'plain_text',
          text: 'Edit Code Review',
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
                  text: getPriority(currentInputs.priority),
                  emoji: true
                },
                value: currentInputs.priority
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
                text: 'The urgency of your pull request that dictates its priority when deciding which Pull Request should be reviewed.',
                emoji: true
              }
            ]
          },
          {
            type: 'input',
            block_id: 'issue_id_section',
            element: {
              type: 'plain_text_input',
              action_id: 'issue_id',
              initial_value: currentInputs.issue_id
            },
            label: {
              type: 'plain_text',
              text: 'Issue ID',
              emoji: true
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'plain_text',
                text: 'The ID of the issue (i.e. CCS-2425).',
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
              ...(isValidHttpUrl(currentInputs.pr_url)
                ? { initial_value: currentInputs.pr_url }
                : {})
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
              ...(currentInputs.pr_description &&
              currentInputs.pr_description !== '!undefined!'
                ? { initial_value: currentInputs.pr_description }
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
                text: 'An optional description that will be posted along with your Pull Request.',
                emoji: true
              }
            ]
          }
        ]
      }
    })

    if (!viewResponse.ok) {
      console.log('Error during request views.open!', viewResponse)
    }

    return { completed: false }
  })
  .addViewSubmissionHandler('edit_modal', async ({ body, inputs, client }) => {
    const private_metadata = JSON.parse(body.view.private_metadata || '{}')
    const metadata = {
      event_type: CodeReviewEvent,
      event_payload: {
        channel_id: private_metadata.channel_id ?? inputs.channel,
        message_ts: private_metadata.message_ts,
        author: private_metadata.author,
        claimer: private_metadata.claimer,
        approver: private_metadata.approver,
        priority:
          body.view.state.values.priority_section.priority.selected_option
            .value,
        issue_id: body.view.state.values.issue_id_section.issue_id.value,
        pr_url: body.view.state.values.pr_url_section.pr_url.value,
        pr_description:
          body.view.state.values.pr_description_section.pr_description.value ??
          '!undefined!'
      }
    }

    const msgResponse = await client.chat.update({
      channel: private_metadata.channel_id,
      ts: private_metadata.message_ts,
      username: inputs.issue_id,
      blocks: createMessage({
        type: metadata.event_payload.approver
          ? 'approved'
          : metadata.event_payload.claimer
          ? 'claimed'
          : 'authored',
        event_payload: metadata.event_payload,
        complete: false
      }),
      metadata
    })

    if (!msgResponse.ok) {
      console.log('Error during request chat.update!', msgResponse)
    }
  })

function isValidHttpUrl(potentialUrl: string) {
  try {
    const url = new URL(potentialUrl)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch (_error) {
    return false
  }
}
