import { DefineFunction, Schema, SlackFunction } from 'deno-slack-sdk/mod.ts'
import { CodeReviewEvent } from '../event_types/code_review_event.ts'
import { codeReviewConfirmModal } from './code_review_confirm_modal.ts'
import { codeReviewEditModal } from './code_review_edit_modal.ts'
import { listReviews } from './code_review_list_reviews.ts'
import { createCodeReviewMessage } from './code_review_message.ts'
import { createCodeReviewMetadata } from './code_review_metadata.ts'
import { codeReviewNotification } from './code_review_notification.ts'

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
      decliner: { type: Schema.slack.types.user_id },
      priority: { type: Schema.types.string },
      issue_id: { type: Schema.types.string },
      pr_url: { type: Schema.types.string },
      pr_description: { type: Schema.types.string }
    },
    required: ['type', 'author', 'channel_id', 'priority', 'issue_id', 'pr_url']
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
    blocks: createCodeReviewMessage(metadata.event_payload, false),
    unfurl_links: false,
    unfurl_media: false,
    username: 'Pull Request',
    icon_url: 'https://raw.githubusercontent.com/pcbowers/pr-bot/main/assets/icon.png',
    text: 'A new Pull Request is ready for Code Review!',
    metadata
  })

  if (!msgResponse.ok) {
    console.log('Error during request chat.postMessage!', msgResponse)
  }

  return { completed: false }
})
  .addBlockActionsHandler(['view_code_review_thread'], () => {
    return { completed: false }
  })
  .addBlockActionsHandler(
    ['claim', 'unclaim', 'approve', 'unapprove', 'decline', 'undecline'],
    async ({ action, inputs, body, client }) => {
      const metadata = createCodeReviewMetadata(action, body, inputs)

      const msgResponse = await client.chat.update({
        channel: body.container.channel_id,
        ts: body.container.message_ts,
        blocks: createCodeReviewMessage(metadata.event_payload, false),
        metadata: metadata
      })

      if (!msgResponse.ok) {
        console.log('Error during request chat.update!', msgResponse)
      } else {
        codeReviewNotification(
          client,
          body.container.channel_id,
          body.container.message_ts,
          body.user.id,
          action.action_id,
          metadata.event_payload
        )
      }

      return { completed: false }
    }
  )
  .addBlockActionsHandler(
    ['overflow', 'complete', 'delete', 'edit', 'list_incomplete_reviews'],
    async ({ action, body, client, inputs }) => {
      const metadata = createCodeReviewMetadata(action, body, inputs)
      let viewResponse: Awaited<ReturnType<typeof client.views.open>> | undefined = undefined

      if (action.action_id === 'complete' || action?.selected_option?.value === 'complete') {
        viewResponse = await client.views.open({
          trigger_id: body.interactivity.interactivity_pointer,
          view: codeReviewConfirmModal(
            metadata.event_payload,
            'Are you sure you want to Complete this PR Code Review? This will make changes to this PR Code Review impossible.',
            'complete_modal'
          )
        })
      } else if (action.action_id === 'delete' || action?.selected_option?.value === 'delete') {
        viewResponse = await client.views.open({
          trigger_id: body.interactivity.interactivity_pointer,
          view: codeReviewConfirmModal(
            metadata.event_payload,
            'Are you sure you want to Delete this PR Code Review? Deleting a PR Code Review is permanent.',
            'delete_modal'
          )
        })
      } else if (action.action_id === 'edit' || action?.selected_option?.value === 'edit') {
        viewResponse = await client.views.open({
          trigger_id: body.interactivity.interactivity_pointer,
          view: codeReviewEditModal(metadata)
        })
      } else if (
        action.action_id === 'list_incomplete_reviews' ||
        action?.selected_option?.value === 'list_incomplete_reviews'
      ) {
        await listReviews(client, body.user.id, inputs.channel)
      }

      if (viewResponse && !viewResponse.ok) {
        console.log('Error during request views.open!', viewResponse)
      }
    }
  )
  .addViewSubmissionHandler('delete_modal', async ({ body, client }) => {
    const event_payload = JSON.parse(body.view.private_metadata || '{}') as ReturnType<
      typeof createCodeReviewMetadata
    >['event_payload']
    const msgResponse = await client.chat.delete({
      channel: event_payload.channel_id,
      ts: event_payload.message_ts
    })

    if (!msgResponse.ok) {
      console.log('Error during request chat.delete!', msgResponse)
      return { response_action: 'clear' }
    } else {
      client.functions.completeSuccess({
        function_execution_id: body.function_data.execution_id,
        outputs: { type: 'delete', ...event_payload }
      })
    }
  })
  .addViewSubmissionHandler('complete_modal', async ({ body, client }) => {
    const event_payload = JSON.parse(body.view.private_metadata || '{}') as ReturnType<
      typeof createCodeReviewMetadata
    >['event_payload']
    const msgResponse = await client.chat.update({
      channel: event_payload.channel_id,
      ts: event_payload.message_ts,
      blocks: createCodeReviewMessage(event_payload, true),
      metadata: event_payload
    })

    if (!msgResponse.ok) {
      console.log('Error during request chat.update!', msgResponse)
    } else {
      client.functions.completeSuccess({
        function_execution_id: body.function_data.execution_id,
        outputs: { type: 'complete', ...event_payload }
      })
    }
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
        decliner: private_metadata.decliner,
        priority: body.view.state.values.priority_section.priority.selected_option.value,
        issue_id: body.view.state.values.issue_id_section.issue_id.value,
        pr_url: body.view.state.values.pr_url_section.pr_url.value,
        pr_description: body.view.state.values.pr_description_section.pr_description.value ?? '!undefined!'
      }
    }

    const msgResponse = await client.chat.update({
      channel: private_metadata.channel_id,
      ts: private_metadata.message_ts,
      username: inputs.issue_id,
      blocks: createCodeReviewMessage(metadata.event_payload, false),
      metadata: metadata
    })

    if (!msgResponse.ok) {
      console.log('Error during request chat.update!', msgResponse)
    }

    codeReviewNotification(
      client,
      private_metadata.channel_id,
      private_metadata.message_ts,
      body.user.id,
      'edit',
      metadata.event_payload
    )
  })
