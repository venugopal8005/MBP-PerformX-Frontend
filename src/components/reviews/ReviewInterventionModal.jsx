import InterventionActionModal from "../issues/InterventionActionModal";
import { createReviewIntervention, getReviewItem } from "../../api/reviews";
import { INTERVENTION_ACTIONS } from "../../utils/interventions";
import { normalizeReviewItem, reviewError } from "../../utils/reviews";

const reviewActions = INTERVENTION_ACTIONS.filter((action) => action.value !== "internal_note");

export default function ReviewInterventionModal({ reviewItem, members, currentUserId, onClose, onSuccess, onAuthorityChanged }) {
  const issueId = reviewItem.routes.issueId || reviewItem.context.issue.id;
  const issue = {
    id: issueId,
    openedAt: reviewItem.openedAt,
    lifecycleRevision: reviewItem.revision,
  };

  const createPayloadBuilder = ({ payload, expectedRevision }) => {
    const interventionPayload = { ...payload };
    delete interventionPayload.expectedIssueRevision;
    return { ...interventionPayload, expectedReviewRevision: expectedRevision };
  };

  const refreshAuthority = async ({ signal }) => {
    const response = await getReviewItem(reviewItem.id, { signal });
    const latest = normalizeReviewItem(response.reviewItem, { detail: true });
    onAuthorityChanged?.(latest);
    return {
      issue: { id: issueId, lifecycleRevision: latest.revision },
      canWrite: latest.permissions.canRecordIntervention === true,
    };
  };

  return (
    <InterventionActionModal
      issue={issue}
      members={members}
      currentUserId={currentUserId}
      mode="create"
      actionOptions={reviewActions}
      initialRevision={reviewItem.revision}
      createTitle="Record action from Review"
      createDescription="Record a bounded human action and complete this Review through its authoritative workflow."
      authorityLabel="Review item"
      createPayloadBuilder={createPayloadBuilder}
      createRequest={(payload, options) => createReviewIntervention(reviewItem.id, payload, options)}
      errorMapper={(error) => reviewError(error, "This Review action could not be recorded.")}
      onClose={onClose}
      onStale={refreshAuthority}
      onSuccess={onSuccess}
    />
  );
}
