import express from 'express';
import cors from 'cors';
const router = express.Router();
router.use(cors())
import {
    getOracleData, updateOracleData, getTransactions, evaluateAml, sendWithAml
} from "./controller";


// execute
router.route('/oracle-data').post(updateOracleData);

// queries
router.route('/oracle-data').get(getOracleData);

// aml
router.route('/aml/transactions').get(getTransactions);
router.route('/aml/evaluate').post(evaluateAml);
router.route('/contract/send-with-aml').post(sendWithAml);

export default router;