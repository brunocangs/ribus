import { Router } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { getTx, signToken } from "../../utils";

export const claimRouter = Router();

claimRouter.get("/:requestId", async (req, res) => {
  const { requestId } = req.params;
  if (!requestId) {
    return res.status(500).send(`Invalid`);
  }
  const item = await getTx(requestId);
  if (item) {
    if (item && item.version && item.version == 2) {
      // Mapping to old ribus api
      let status: string;
      let message: string;
      let hash: string;
      let state = item.state;
      if (state) {
        if (state.matches("success")) {
          status = "SUCCESS";
          message = "Claim realizado com sucesso";
        } else if (state.matches("aborted")) {
          status = "ERROR";
          message = "Falha ao realizar claim";
        } else {
          status = "WAITING";
          message = "Pedido em processamento";
        }
        hash = state.context.txHash;
      } else {
        throw new Error("Machine without state");
      }
      return res.json({
        token: signToken(
          {
            ...item.jwt,
            status,
            message,
            hash,
          },
          item.id
        ),
      });
    } else {
      return res.json({
        token: signToken(item, item.id),
      });
    }
  } else {
    return res.status(404).send(`Not Found`);
  }
});

claimRouter.get(`/user/:userId`, async (req, res) => {
  const { userId } = req.params;
  const userIdAsNumber = +userId;
  if (!userId || isNaN(userIdAsNumber)) return res.status(500).send(`Invalid`);
  const firestore = getFirestore();
  const requestsCollection = firestore.collection("claim_requests");

  const requestsByUser = requestsCollection.where(
    `from_user_id`,
    `==`,
    userIdAsNumber
  );
  const requests = await requestsByUser.get();
  return res.json(requests.docs.map((doc) => doc.data()));
});
