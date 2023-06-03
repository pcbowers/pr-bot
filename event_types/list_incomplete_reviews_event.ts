import { DefineEvent, Schema } from 'deno-slack-sdk/mod.ts'

export const ListIncompleteReviewsEvent = DefineEvent({
  name: 'list_incomplete_reviews_event',
  title: 'List Incomplete PR Reviews',
  type: Schema.types.object,
  properties: {
    count: { type: Schema.types.number },
    reviews: { type: Schema.types.array, items: { type: Schema.types.string } }
  },
  required: ['count', 'reviews'],
  additionalProperties: false
})
