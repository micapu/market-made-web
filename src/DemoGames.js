
export const ExampleGameData1 = [
    ["gameState",{"gameName":"Example Game","gameMinutes":5,"gameId":0,"parties":[],"playerData":{},"bids":[],"asks":[],"ticks":[],"transactionId":1,"ackTimestamp":1637721063820}]
    , ["gameJoin", {"name": "asd"}]
    , ["playerDataUpdate", {
        "name": "asd",
        "longPosition": 0,
        "shortPosition": 0,
        "totalOutstandingLongVolume": 0,
        "totalOutstandingShortVolume": 0,
        "scrapeProfit": 0,
        "totalLongVolume": 0,
        "totalShortVolume": 0,
        "bidTicks": [],
        "askTicks": [],
        "transactionId": 1,
        "ackTimestamp": 1637721063820
    }]
    , ["gameJoin", {"name": "qwe"}]
    , ["playerDataUpdate", {
        "name": "qwe",
        "longPosition": 0,
        "shortPosition": 0,
        "totalOutstandingLongVolume": 0,
        "totalOutstandingShortVolume": 0,
        "scrapeProfit": 0,
        "totalLongVolume": 0,
        "totalShortVolume": 0,
        "bidTicks": [],
        "askTicks": [],
        "transactionId": 3,
        "ackTimestamp": 1637721066169
    }]
    , ["orderInsert", {
        "price": 2,
        "volume": 2,
        "isBid": true,
        "originalVolume": 2,
        "orderId": 0,
        "name": "qwe",
        "gameId": 0,
        "transactionId": 4,
        "ackTimestamp": 1637721078420
    }]
    , ["orderUpdate", {
        "price": 2,
        "volume": 4,
        "isBid": true,
        "originalVolume": 4,
        "orderId": 0,
        "name": "qwe",
        "gameId": 0,
        "transactionId": 5,
        "ackTimestamp": 1637721079752
    }]
    , ["orderUpdate", {
        "price": 2,
        "volume": 6,
        "isBid": true,
        "originalVolume": 6,
        "orderId": 0,
        "name": "qwe",
        "gameId": 0,
        "transactionId": 6,
        "ackTimestamp": 1637721080509
    }]
    , ["orderUpdate", {
        "price": 2,
        "volume": 8,
        "isBid": true,
        "originalVolume": 8,
        "orderId": 0,
        "name": "qwe",
        "gameId": 0,
        "transactionId": 7,
        "ackTimestamp": 1637721080960
    }]
    , ["orderUpdate", {
        "price": 2,
        "volume": 10,
        "isBid": true,
        "originalVolume": 10,
        "orderId": 0,
        "name": "qwe",
        "gameId": 0,
        "transactionId": 8,
        "ackTimestamp": 1637721081443
    }]
    , ["onTick", {
        "price": 2,
        "volume": 4,
        "buyer": "qwe",
        "bidWasAggressor": false,
        "seller": "asd",
        "timestamp": 1637721084708,
        "transactionId": 9,
        "ackTimestamp": 1637721084708
    }]
    , ["playerDataUpdate", {
        "name": "qwe",
        "longPosition": 8,
        "shortPosition": 0,
        "totalOutstandingLongVolume": -4,
        "totalOutstandingShortVolume": 0,
        "scrapeProfit": 0,
        "totalLongVolume": 4,
        "totalShortVolume": 0,
        "bidTicks": [{"price": 2, "volume": 4}],
        "askTicks": [],
        "transactionId": 10,
        "ackTimestamp": 1637721084709,
        "scrapeValue": 0
    }]
    , ["playerDataUpdate", {
        "name": "asd",
        "longPosition": 0,
        "shortPosition": 8,
        "totalOutstandingLongVolume": 0,
        "totalOutstandingShortVolume": -4,
        "scrapeProfit": 0,
        "totalLongVolume": 0,
        "totalShortVolume": 4,
        "bidTicks": [],
        "askTicks": [{"price": 2, "volume": 4}],
        "transactionId": 11,
        "ackTimestamp": 1637721084710,
        "scrapeValue": 0
    }]
    , ["orderUpdate", {
        "price": 2,
        "volume": 6,
        "isBid": true,
        "originalVolume": 10,
        "orderId": 0,
        "name": "qwe",
        "gameId": 0,
        "transactionId": 12,
        "ackTimestamp": 1637721084710
    }]
    , ["onTick", {
        "price": 2,
        "volume": 4,
        "buyer": "qwe",
        "bidWasAggressor": false,
        "seller": "asd",
        "timestamp": 1637721092681,
        "transactionId": 13,
        "ackTimestamp": 1637721092681
    }]
    , ["playerDataUpdate", {
        "name": "qwe",
        "longPosition": 16,
        "shortPosition": 0,
        "totalOutstandingLongVolume": -8,
        "totalOutstandingShortVolume": 0,
        "scrapeProfit": 0,
        "totalLongVolume": 8,
        "totalShortVolume": 0,
        "bidTicks": [{"price": 2, "volume": 4}, {"price": 2, "volume": 4}],
        "askTicks": [],
        "transactionId": 14,
        "ackTimestamp": 1637721092681,
        "scrapeValue": 0
    }]
    , ["playerDataUpdate", {
        "name": "asd",
        "longPosition": 0,
        "shortPosition": 16,
        "totalOutstandingLongVolume": 0,
        "totalOutstandingShortVolume": -8,
        "scrapeProfit": 0,
        "totalLongVolume": 0,
        "totalShortVolume": 8,
        "bidTicks": [],
        "askTicks": [{"price": 2, "volume": 4}, {"price": 2, "volume": 4}],
        "transactionId": 15,
        "ackTimestamp": 1637721092682,
        "scrapeValue": 0
    }]
    , ["orderUpdate", {
        "price": 2,
        "volume": 2,
        "isBid": true,
        "originalVolume": 10,
        "orderId": 0,
        "name": "qwe",
        "gameId": 0,
        "transactionId": 16,
        "ackTimestamp": 1637721092683
    }]
    , ["onTick", {
        "price": 2,
        "volume": 2,
        "buyer": "qwe",
        "bidWasAggressor": false,
        "seller": "asd",
        "timestamp": 1637721092869,
        "transactionId": 17,
        "ackTimestamp": 1637721092870
    }]
    , ["playerDataUpdate", {
        "name": "qwe",
        "longPosition": 20,
        "shortPosition": 0,
        "totalOutstandingLongVolume": -10,
        "totalOutstandingShortVolume": 0,
        "scrapeProfit": 0,
        "totalLongVolume": 10,
        "totalShortVolume": 0,
        "bidTicks": [{"price": 2, "volume": 4}, {"price": 2, "volume": 4}, {"price": 2, "volume": 2}],
        "askTicks": [],
        "transactionId": 18,
        "ackTimestamp": 1637721092870,
        "scrapeValue": 0
    }]
    , ["playerDataUpdate", {
        "name": "asd",
        "longPosition": 0,
        "shortPosition": 20,
        "totalOutstandingLongVolume": 0,
        "totalOutstandingShortVolume": -10,
        "scrapeProfit": 0,
        "totalLongVolume": 0,
        "totalShortVolume": 10,
        "bidTicks": [],
        "askTicks": [{"price": 2, "volume": 4}, {"price": 2, "volume": 4}, {"price": 2, "volume": 2}],
        "transactionId": 19,
        "ackTimestamp": 1637721092871,
        "scrapeValue": 0
    }]
    , ["orderUpdate", {
        "price": 2,
        "volume": 0,
        "isBid": true,
        "originalVolume": 10,
        "orderId": 0,
        "name": "qwe",
        "gameId": 0,
        "transactionId": 20,
        "ackTimestamp": 1637721092871
    }]
    , ["orderInsert", {
        "price": 2,
        "volume": 2,
        "isBid": false,
        "originalVolume": 4,
        "orderId": 7,
        "name": "asd",
        "gameId": 0,
        "transactionId": 21,
        "ackTimestamp": 1637721092871
    }]
    , ["orderUpdate", {
        "price": 2,
        "volume": 6,
        "isBid": false,
        "originalVolume": 8,
        "orderId": 7,
        "name": "asd",
        "gameId": 0,
        "transactionId": 22,
        "ackTimestamp": 1637721093142
    }]
    , ["onTick", {
        "price": 2,
        "volume": 2,
        "buyer": "qwe",
        "bidWasAggressor": true,
        "seller": "asd",
        "timestamp": 1637721108548,
        "transactionId": 23,
        "ackTimestamp": 1637721108548
    }]
    , ["playerDataUpdate", {
        "name": "qwe",
        "longPosition": 24,
        "shortPosition": 0,
        "totalOutstandingLongVolume": -12,
        "totalOutstandingShortVolume": 0,
        "scrapeProfit": 0,
        "totalLongVolume": 12,
        "totalShortVolume": 0,
        "bidTicks": [{"price": 2, "volume": 4}, {"price": 2, "volume": 4}, {"price": 2, "volume": 2}, {
            "price": 2,
            "volume": 2
        }],
        "askTicks": [],
        "transactionId": 24,
        "ackTimestamp": 1637721108549,
        "scrapeValue": 0
    }]
    , ["playerDataUpdate", {
        "name": "asd",
        "longPosition": 0,
        "shortPosition": 24,
        "totalOutstandingLongVolume": 0,
        "totalOutstandingShortVolume": -12,
        "scrapeProfit": 0,
        "totalLongVolume": 0,
        "totalShortVolume": 12,
        "bidTicks": [],
        "askTicks": [{"price": 2, "volume": 4}, {"price": 2, "volume": 4}, {"price": 2, "volume": 2}, {
            "price": 2,
            "volume": 2
        }],
        "transactionId": 25,
        "ackTimestamp": 1637721108550,
        "scrapeValue": 0
    }]
    , ["orderUpdate", {
        "price": 2,
        "volume": 4,
        "isBid": false,
        "originalVolume": 8,
        "orderId": 7,
        "name": "asd",
        "gameId": 0,
        "transactionId": 26,
        "ackTimestamp": 1637721108550
    }]
]

export const ExampleGameData2 = []