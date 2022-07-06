import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { signToken } from "../utils";

export const claimRouter = Router();

claimRouter.get("/:requestId", async (req, res) => {
  const { requestId } = req.params;
  if (!requestId) {
    return res.status(500).send(`Invalid`);
  }
  const firestore = getFirestore();
  const requestsCollection = firestore.collection("claim_requests");
  const requestSnapshot = await requestsCollection.doc(requestId).get();
  if (requestSnapshot && requestSnapshot.exists) {
    return res.json({
      token: signToken(requestSnapshot.data(), requestSnapshot.id),
    });
  } else {
    return res.status(404).send(`Not Found`);
  }
});

claimRouter.get(`/user/:userId`, async (req, res) => {
  const { userId } = req.params;
  const userIdAsNumber = +userId;
  if (isNaN(userIdAsNumber)) return res.status(500).send(`Invalid`);
  if (!userId) {
    return res.status(500).send(`Invalid`);
  }
  const firestore = getFirestore();
  const requestsCollection = firestore.collection("claim_requests");

  const requestsByUser = requestsCollection.where(
    `user_id`,
    `==`,
    userIdAsNumber
  );
  const requests = await requestsByUser.get();
  return res.json(requests.docs.map((doc) => doc.data()));
});
