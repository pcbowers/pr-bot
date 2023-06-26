import { DefineFunction, Schema, SlackFunction } from 'deno-slack-sdk/mod.ts'
import { CodeReviewEvent } from '../event_types/code_review_event.ts'
import { codeReviewConfirmModal } from './helpers/confirmation_modal.ts'
import { codeReviewEditModal } from './helpers/review_edit.ts'
import { codeReviewMarkModal } from './helpers/review_mark.ts'
import { createCodeReviewMessage } from './helpers/review_message.ts'
import { createCodeReviewMetadata } from './helpers/review_metadata.ts'
import { codeReviewNotification, userToNotify } from './helpers/review_notification.ts'

export const CodeReviewFunction = DefineFunction({
  callback_id: 'code_review_function',
  title: 'Create and Manage a Pull Request Code Review Message',
  source_file: 'functions/code_review_function.ts',
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      channel_id: { type: Schema.slack.types.channel_id },
      priority: { type: Schema.types.string },
      issue_id: { type: Schema.types.string },
      pr_url: { type: Schema.types.string },
      pr_description: { type: Schema.types.string }
    },
    required: ['interactivity', 'channel_id', 'priority', 'issue_id', 'pr_url']
  },
  output_parameters: {
    properties: {
      type: { type: Schema.types.string },
      channel_id: { type: Schema.slack.types.channel_id },
      message_ts: { type: Schema.slack.types.message_ts },
      author: { type: Schema.slack.types.user_id },
      claimer: { type: Schema.slack.types.user_id },
      marker: { type: Schema.slack.types.user_id },
      mark: { type: Schema.types.string },
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
      channel_id: inputs.channel_id,
      author: inputs.interactivity.interactor.id,
      priority: inputs.priority,
      issue_id: inputs.issue_id,
      pr_url: inputs.pr_url,
      pr_description: inputs.pr_description
    }
  }

  const msgResponse = await client.chat.postMessage({
    channel: inputs.channel_id,
    blocks: createCodeReviewMessage(metadata.event_payload, false),
    unfurl_links: false,
    unfurl_media: false,
    username: `Pull Request for ${inputs.issue_id?.split('|')[0]}`,
    icon_url: 'https://raw.githubusercontent.com/pcbowers/pr-bot/main/assets/icon.png',
    text: `A new Pull Request for ${inputs.issue_id?.split('|')[0]} is ready for Code Review!`,
    metadata: metadata
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
    ['claim', 'unclaim', 'unmark', 'approve', 'unapprove', 'decline', 'undecline'],
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
          userToNotify(body, inputs, action.action_id),
          body.user.id,
          action.action_id,
          metadata.event_payload
        )
      }

      return { completed: false }
    }
  )
  .addBlockActionsHandler(
    ['overflow', 'complete', 'delete', 'edit', 'mark'],
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
      } else if (action.action_id === 'mark' || action?.selected_option?.value === 'mark') {
        viewResponse = await client.views.open({
          trigger_id: body.interactivity.interactivity_pointer,
          view: codeReviewMarkModal(metadata)
        })
      }

      if (viewResponse && !viewResponse.ok) {
        console.log('Error during request views.open!', viewResponse)
      }
    }
  )
  .addViewSubmissionHandler('delete_modal', async ({ body, client }) => {
    const private_metadata = JSON.parse(body.view.private_metadata || '{}') as ReturnType<
      typeof createCodeReviewMetadata
    >['event_payload']
    const msgResponse = await client.chat.delete({
      channel: private_metadata.channel_id,
      ts: private_metadata.message_ts
    })

    if (!msgResponse.ok) {
      console.log('Error during request chat.delete!', msgResponse)
    } else {
      client.functions.completeSuccess({
        function_execution_id: body.function_data.execution_id,
        outputs: { type: 'delete', ...private_metadata }
      })
    }
  })
  .addViewSubmissionHandler('complete_modal', async ({ body, client }) => {
    const private_metadata = JSON.parse(body.view.private_metadata || '{}') as ReturnType<
      typeof createCodeReviewMetadata
    >['event_payload']
    const metadata = {
      event_type: CodeReviewEvent,
      event_payload: private_metadata
    }

    const msgResponse = await client.chat.update({
      channel: private_metadata.channel_id,
      ts: private_metadata.message_ts,
      blocks: createCodeReviewMessage(private_metadata, true),
      metadata: metadata
    })

    if (!msgResponse.ok) {
      console.log('Error during request chat.update!', msgResponse)
    } else {
      client.functions.completeSuccess({
        function_execution_id: body.function_data.execution_id,
        outputs: { type: 'complete', ...private_metadata }
      })
    }
  })
  .addViewSubmissionHandler('mark_modal', async ({ body, client, inputs }) => {
    const private_metadata = JSON.parse(body.view.private_metadata || '{}') as ReturnType<
      typeof createCodeReviewMetadata
    >['event_payload']
    const metadata = {
      event_type: CodeReviewEvent,
      event_payload: {
        ...private_metadata,
        mark: body.view.state.values.mark_section.mark.selected_option.value
      }
    }

    const msgResponse = await client.chat.update({
      channel: private_metadata.channel_id,
      ts: private_metadata.message_ts,
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
      userToNotify(body, inputs),
      body.user.id,
      'mark',
      metadata.event_payload
    )
  })
  .addViewSubmissionHandler('edit_modal', async ({ body, client, inputs }) => {
    const private_metadata = JSON.parse(body.view.private_metadata || '{}') as ReturnType<
      typeof createCodeReviewMetadata
    >['event_payload']
    const metadata = {
      event_type: CodeReviewEvent,
      event_payload: {
        ...private_metadata,
        priority: body.view.state.values.priority_section.priority.selected_option.value,
        issue_id: body.view.state.values.issue_id_section.issue_id.value,
        pr_url: body.view.state.values.pr_url_section.pr_url.value,
        pr_description: body.view.state.values.pr_description_section.pr_description.value ?? '!undefined!'
      }
    }

    const msgResponse = await client.chat.update({
      channel: private_metadata.channel_id,
      ts: private_metadata.message_ts,
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
      userToNotify(body, inputs),
      body.user.id,
      'edit',
      metadata.event_payload
    )
  })
