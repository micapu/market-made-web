import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {io} from "socket.io-client";
import {useParams} from "react-router-dom";
import {
    Button,
    Card,
    CardContent,
    Chip,
    MuiThemeProvider,
    Slider,
    TextField,
    Tooltip,
    withStyles,
} from "@material-ui/core";
import {themeOptions} from "./colors";
import Chart from "react-apexcharts";
import {CardTitle} from "reactstrap";
import LogoutIcon from '@mui/icons-material/Logout';
import {useAlert} from "react-alert";


const BuySellSlider = withStyles({
    rail: {
        backgroundImage: "linear-gradient(to right," +
            "     red 20%, orange 20% 100%)"
    },
    track: {
        backgroundImage: "linear-gradient(.25turn, red, green)"
    }
})(Slider);

function getShortname(name) {
    if (!name) {
        // Bug detector
        return "NONAME"
    }
    name = name.toUpperCase()
    if (name.length < 3) {
        return name.slice(0, 3).toUpperCase()
    }
    let splitName = name.split(" ");
    if (splitName.length >= 2) {
        return splitName.slice(0, 3).reduce((prev, curr) => prev + (curr.length > 0 ? curr[0] : ''), '')
    }
    return name.slice(0, 3)
}

const transactions = new Set();

function TradeDialog(props) {

    return <Card style={{...props.style}} elevation={20}>
        {props.children}
    </Card>
}

function PlayerOrderChip(props: {}) {
    const {partyOrderInfo, name, cancelOrder, transparent = false} = props
    let width = 55;
    let filledPercentString = ' ';
    if (partyOrderInfo.volume && partyOrderInfo.originalVolume) {
        let filledPercent = 1 - (partyOrderInfo.volume / partyOrderInfo.originalVolume);
        filledPercentString = " " + Math.round(filledPercent * 100).toString() + "%"
        width += 50;
    }

    let isYou = partyOrderInfo.name === name;
    let variant = !transparent ? "default" : "outlined";
    if (isYou) {
        return <PlayerChip style={{width}} variant={variant} label={"You" + filledPercentString}
                           onDelete={cancelOrder}/>
    }
    return <PlayerChip style={{width}} variant={variant} name={partyOrderInfo.name}/>
}

function PlayerChip(props) {
    return <Chip size={"small"} {...props} label={props.label || getShortname(props.name)}/>
}

function PriceVolume(props) {
    const {
        price, volume, partyOrderInfo, name, filledPercent, onClick = () => {
        }, cancelOrderById, hoverAble = true, background = 'transparent', backgroundWidth = 1
    } = props;
    const paddingRight = 15;
    const [isShown, setIsShown] = useState(false);
    const height = 30;
    const backgroundWidthPercentage = (backgroundWidth * 100).toString() + '%'
    return <div style={{position: 'relative'}}>
        <div onClick={onClick}
             onMouseEnter={() => setIsShown(true)}
             onMouseLeave={() => setIsShown(false)}
             style={{
                 position: 'absolute',
                 background,
                 opacity: '20%',
                 width: backgroundWidthPercentage,
                 height,
                 pointerEvents: 'none',
                 right: 0,
                 top: 0
             }}/>
        <div style={{
            display: "flex",
            flexDirection: "row",
            background: isShown && hoverAble ? "#705C6D" : "inherit",
            height,
            marginBottom: 2
        }}
             onMouseEnter={() => setIsShown(true)}
             onMouseLeave={() => setIsShown(false)}
             onClick={onClick}>
            {partyOrderInfo !== undefined ? partyOrderInfo.map((partyOrderInfo) => (
                <PlayerOrderChip partyOrderInfo={partyOrderInfo} name={name} key={partyOrderInfo.orderId}
                                 filledPercent={filledPercent}
                                 cancelOrder={() => cancelOrderById(partyOrderInfo.orderId)}/>
            )) : []}
            <div style={{display: "flex", flex: 1, paddingRight}}>

                <div style={{flex: 1}}>
                </div>
                {price}
            </div>
            <div style={{display: "flex", flex: 1, paddingRight}}>
                <div style={{flex: 1}}>
                </div>
                {volume}
            </div>
        </div>
    </div>
}

function Bid(props) {
    const {price, volume, onClick, cancelOrderById, backgroundWidth, partyOrderInfo, yourFilledPercent, name} = props;

    return <PriceVolume  {...{
        price,
        volume,
        partyOrderInfo,
        name,
        onClick,
        cancelOrderById,
        filledPercent: yourFilledPercent,
        background: themeOptions.palette.buy,
        backgroundWidth
    }}/>
}

function Ask(props) {
    const {price, volume, onClick, cancelOrderById, backgroundWidth, partyOrderInfo, yourFilledPercent, name} = props;

    return <PriceVolume  {...{
        price,
        volume,
        partyOrderInfo,
        name,
        onClick,
        cancelOrderById,
        filledPercent: yourFilledPercent,
        background: themeOptions.palette.sell,
        backgroundWidth
    }}/>
}

function aggregateOrders(orders) {
    const pricePoints = {}

    orders.forEach((order) => {
        if (pricePoints[order.price] === undefined) {
            pricePoints[order.price] = []
        }
        pricePoints[order.price].push(order)
    })

    return Object.entries(pricePoints).sort(([k, order1], [k2, order2]) => orderSortFunction(order1, order2))
        .map(([k, orders]) => {
            const firstOrder = Object.assign({}, orders[0])

            firstOrder.partyOrderInfo = [{
                name: firstOrder.name,
                originalVolume: firstOrder.originalVolume,
                volume: firstOrder.volume,
                orderId: firstOrder.orderId
            }]

            // delete any values "personal" to that order
            delete firstOrder.name

            for (let i = 1; i < orders.length; i++) {
                let order = orders[i];
                const orderInfo = {
                    name: order.name, originalVolume: order.originalVolume,
                    volume: order.volume,
                    orderId: order.orderId
                };
                firstOrder.partyOrderInfo.push(orderInfo)
                firstOrder.volume += order.volume
            }
            return firstOrder;
        })

}

function PullOrdersButton(props: { onClick: pullOrders | * }) {
    return <Tooltip title="Pull all Outstanding Orders">
        <Button
            disabled={!props.youHaveOutstandingOrders}
            style={{
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: themeOptions.palette.sell,
                borderRadius: 50,
            }}
            onClick={props.onClick}>
            <LogoutIcon size={30} color="#000"/>
        </Button>
    </Tooltip>
}

function OrderBookControls(props: {}) {
    return <div style={{display: "flex", flexDirection: "row", justifyContent: "space-evenly", ...props.style}}>
        <Tooltip title="Place bid at minimum price above current best">
            <Button disabled={!props.bidsExist} variant={"outlined"} color={themeOptions.palette.buy}
                    onClick={props.placeDimeBid}> Dime Bid </Button>
        </Tooltip>
        <PullOrdersButton onClick={props.pullOrders} youHaveOutstandingOrders={props.youHaveOutstandingOrders}/>
        <Tooltip title="Place ask at maximum price below current best">
            <Button disabled={!props.asksExist} variant={"outlined"} color={themeOptions.palette.sell}
                    onClick={props.placeDimeAsk}> Dime Ask </Button>
        </Tooltip>
    </div>;
}

function OrderBook(props) {
    const {
        bids,
        asks,
        setActivePrice,
        name,
        cancelOrderById,
        placeDimeBid,
        placeDimeAsk,
        pullOrders,
        youHaveOutstandingOrders,
        bidsExist,
        asksExist
    } = props;
    console.log("bids", bids, "asks", asks)
    const OrderBookHeaders = () => (
        <div style={{display: "flex", flexDirection: "row"}}>
            <span style={{flex: 1}}>Price</span>
            <span style={{flex: 1}}>Total</span>
        </div>
    )
    const totalAskVolume = Math.max(5, asks.reduce((i, {volume}) => volume + i, 0))
    const totalBidVolume = Math.max(5, bids.reduce((i, {volume}) => volume + i, 0))
    return <TradeDialog style={{height: 300, width: 400, display: "flex", flexDirection: "column", flex: 1}}>
        <h2>
            Order Book
        </h2>
        <div style={{display: "flex", flexDirection: "column", flex: 1, maxHeight:"40%"}}>
            <OrderBookHeaders/>
            <div style={{display: "flex", flexDirection: "column-reverse", flex: 1}}>

                {aggregateOrders(asks)
                    .map((ask) => (
                        <Ask {...ask} name={name} key={ask.orderId} cancelOrderById={cancelOrderById}
                             backgroundWidth={ask.volume / totalAskVolume} onClick={() => setActivePrice(ask.price)}/>
                    ))}
            </div>
        </div>
        <OrderBookControls style={{margin: 10}} {...{
            placeDimeAsk,
            placeDimeBid,
            pullOrders,
            youHaveOutstandingOrders,
            bidsExist,
            asksExist
        }}/>
        <div style={{display: "flex", flexDirection: "column", flex: 1, maxHeight:"40%"}}>
            <div style={{display: "flex", flexDirection: "column-reverse", justifyContent: "flex-end", flex: 1}}>
                {aggregateOrders(bids).map((bid) => (
                    <Bid {...bid} name={name} key={bid.orderId} cancelOrderById={cancelOrderById}
                         backgroundWidth={bid.volume / totalBidVolume} onClick={() => setActivePrice(bid.price)}/>
                ))}
            </div>
            <div style={{flex: 1}}/>
            <OrderBookHeaders/>
        </div>
    </TradeDialog>
}

function OrderWindow(props) {

    const {
        submitOrder,
        standingAskVol,
        standingBidVol,
        yourPlayerData,
        socket,
        price,
        setPrice,
        name
    } = props;

    const [volume, setVolume] = useState(0);

    const isBid = () => volume > 0;

    const yourPosition = yourPlayerData ? yourPlayerData.totalLongVolume - yourPlayerData.totalShortVolume : 0

    const maxSell = -maxPosition + standingAskVol + yourPosition
    const maxBuy = maxPosition - standingBidVol - yourPosition;

    let cappedVolume = Math.min(Math.max(volume, maxSell), maxBuy);
    if (cappedVolume && cappedVolume !== volume) {
        setVolume(cappedVolume)
    }
    return <TradeDialog style={{height: 300, width: 400, marginBottom: 20}}>
        <h2>
            Place an Order
        </h2>
        <div style={{
            display: "flex",
            flexDirection: 'column',
            height: 240,
            padding: 30,
            width: 340,
            alignItems: 'center'
        }}>
            <TextField type="number" label={"Price"} style={{width: 200}} value={price}
                       onChange={(e) => setPrice(e.target.value)}/>
            <TextField type="number" style={{width: 200}} label="Volume" value={volume}
                       onChange={(e) => setVolume(Math.min(Math.max(e.target.value, maxSell), maxBuy))}/>
            <BuySellSlider
                defaultValue={0}
                step={1}
                max={maxBuy}
                min={maxSell}
                marks={[{value: 0, label: "0"}, {value: maxSell, label: maxSell}, {value: maxBuy, label: maxBuy}]}
                value={volume}
                style={{marginTop: "auto", display: 'block', width: 300, marginBottom: 30}}
                onChange={(event, newValue) => setVolume(newValue)}>
            </BuySellSlider>
            <Button variant="contained" color={"primary"} style={{
                marginBottom: 20, ...(isBid() ? {} : {
                    backgroundColor: themeOptions.palette.sell,
                    color: "white"
                })
            }} onClick={() => submitOrder(price, volume, "limit")}>
                Place {isBid() ? "Bid" : "Offer"}
            </Button>
        </div>
    </TradeDialog>
}

const maxPosition = 20

function sortedIndex(array, value, compareFun) {
    var low = 0,
        high = array.length;

    while (low < high) {
        var mid = (low + high) >>> 1;
        if (compareFun(array[mid]) < compareFun(value)) low = mid + 1;
        else high = mid;
    }
    return low;
}

function insertSorted(array, value, compareFun) {
    array.splice(sortedIndex(array, value, compareFun), 0, value)
}

function PricePoint(props) {
    const {price, volume} = props;
    return <div>{volume}@${price}</div>
}

function Tick(newTick) {
    const {price, volume, name, buyer, seller, bidWasAggressor} = newTick
    const setOpacity = (hex, alpha) => `${hex}${Math.floor(alpha * 255).toString(16).padStart(2, 0)}`;
    return <div style={{
        display: "flex",
        justifyContent: "center",
        background: setOpacity(bidWasAggressor ? themeOptions.palette.buy : themeOptions.palette.sell, 0.2)
    }}>
        <PlayerOrderChip partyOrderInfo={{name: buyer}} transparent={true} name={name}/>
        <div style={{display: "flex", flex: 0.7, justifyContent: "center", marginLeft: "auto", marginRight: "auto"}}>
            <PricePoint price={price} volume={volume}/></div>
        <PlayerOrderChip partyOrderInfo={{name: seller}} transparent={true} name={name}/>
    </div>
}

function TickBook(props) {
    const {ticks, name} = props
    return <TradeDialog style={{
        background: themeOptions.palette.secondary.dark, marginLeft: 10, height: "100%", flex: 1, flexBasis: 120
    }}>
        <CardContent>
            <h3>
                Ticks
            </h3>
        </CardContent>

        <div style={{display: "flex", flexDirection: "column-reverse"}}>
            {ticks.map((newTick) => <Tick {...newTick} name={name}/>)}
        </div>
    </TradeDialog>;
}

function seenTransaction({transactionId}) {
    console.log("checking seen transaction", transactionId, transactions.toString(), transactions.has(transactionId))
    // asd
    if (transactions.has(transactionId)) {
        return true;
    }
    transactions.add(transactionId);
    return false;
}

function safeDiv(n, d) {
    if (d === 0) {
        return 0;
    }
    return n / d
}

const fractionDigits = 2;

function Player(props: {}) {
    const {playerData} = props
    console.log("playerdata in player is ", props)
    const averageBuy = safeDiv(playerData.longPosition, playerData.totalLongVolume);
    const averageSell = safeDiv(playerData.shortPosition, playerData.totalShortVolume);
    return <Card style={{width: 200, height: 150}}>
        <CardTitle>
            {getShortname(playerData.name)}
        </CardTitle>
        <div style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            width: "100%",
            justifyContent: "center"
        }}>
            <span>${playerData.scrapedValue}</span>
            <img
                style={{display: "inline-block", height: 17, width: 17, marginTop: 2}}
                src={true ?
                    "https://img.icons8.com/ios-glyphs/100/26e07f/sort-up.png" :
                    "https://img.icons8.com/ios-glyphs/100/26e07f/sort-down.png"}/>
        </div>
        <div style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            width: "100%",
            justifyContent: "center"
        }}>
            <span>
                Position : {(playerData.totalLongVolume - playerData.totalShortVolume).toFixed(fractionDigits)}
                <br/>
                Average Buy Price {averageBuy.toFixed(fractionDigits)}
                <br/>
                Average Sell Price {averageSell.toFixed(fractionDigits)}
            </span>
        </div>
    </Card>;
}

function PlayerDataDiag(props) {
    const {playerData} = props
    // null comes in here quit it
    console.log("playerdata is ", props)
    return <TradeDialog style={{width: "100%"}}>
        <div style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-around",
            overflowY: "scroll",
            maxHeight: 300
        }}>
            {playerData.map((playerData) => (
                <Player playerData={playerData}/>
            ))}
        </div>
    </TradeDialog>;
}

let time = 1538884800000
let currprice = 6605


function orderSortFunction({price: price1, orderId: orderId1}, {price: price2, orderId: orderId2}) {
    return (+(price1 > price2) || +(price1 === price2) - 1) ||
        (+(orderId1 > orderId2) || +(orderId1 === orderId2) - 1)
}

const Market = (props) => {
    const {gameId} = useParams();
    const {height, width, replayData} = props;
    const [socket] = useState(() => io(`/ws`, {
//        transports: ['websocket'],
        withCredentials: true,
    }));

    const [error, setError] = useState('');

    // Game state
    const [name, setName] = useState('');
    const [joined, setJoined] = useState(false);
    const [parties, setParties] = useState([]);
    const [bids, setBids] = useState([])
    const [asks, setAsks] = useState([])
    // const [stockData, setStockData] = useState([{
    //     x: new Date(1538874000000),
    //     y: [6600.55, 6605, 6589.14, 6593.01]
    // },
    //     {
    //         x: new Date(1538875800000),
    //         y: [6593.15, 6605, 6592, 6603.06]
    //     },
    //     {
    //         x: new Date(1538877600000),
    //         y: [6603.07, 6604.5, 6599.09, 6603.89]
    //     },
    //     {
    //         x: new Date(1538879400000),
    //         y: [6604.44, 6604.44, 6600, 6603.5]
    //     },
    //     {
    //         x: new Date(1538881200000),
    //         y: [6603.5, 6603.99, 6597.5, 6603.86]
    //     },
    //     {
    //         x: new Date(1538883000000),
    //         y: [6603.85, 6605, 6600, 6604.07]
    //     },
    //     {
    //         x: new Date(1538884800000),
    //         y: [6604.98, 6606, 6604.07, 6606]
    //     },
    // ]);
    const timeInterval = 1538884800000 - 1538883000000
    useEffect(() => {
        /*
        setInterval(()=>{
            time += timeInterval
            currprice = ((Math.random() * 0.1) + 0.951) * currprice
            let high = currprice * ((Math.random() * 0.07) + 1)
            let low = currprice * (1 - (Math.random() * 0.07))
            let close = currprice * (Math.random() * 0.1 + 0.95)
            setTicks((ticks)=>[...ticks, {timestamp:new Date().getTime(), price:currprice, bidWasAggressor:true,
                buyer:"bot-1", seller:"bot-2"}])
            setStockData((sd) => [...sd.slice(Math.max(sd.length - 80, 0)), {
                x: new Date(time),
                y : [currprice, high, low, close]
            }])
        },3000)*/
    }, [])
    const [myOutstandingOrders, setMyOutStandingOrders] = useState([])
    console.log("My outstanding orders", myOutstandingOrders)
    const [ticks, setTicks] = useState([])
    const [playerData, setPlayerData] = useState({})
    const [gameName, setGameName] = useState()
    const [gameMinutes, setGameMinutes] = useState()
    const [tickSize, setTickSize] = useState()
    const ticksRef = useRef(ticks)
    const stockData = useMemo(() => {
        //const ticks = ticksRef.current
        const age = 30
        const timeInterval = 60 * 1000;
        const intervals = []
        let currInterval = undefined;
        const roundTime = (time) => Math.ceil(time / timeInterval) + timeInterval
        const finishInterval = (timeWindow) => {
            const {prices} = timeWindow;
            timeWindow.high = Math.max(...prices)
            timeWindow.low = Math.min(...prices)
            timeWindow.close = prices[0]
            timeWindow.open = prices[prices.length - 1]
        }
        for (let i = ticks.length - 1; i >= 0; i--) {
            const tick = ticks[i];
            let timeWindow = roundTime(tick.timestamp);
            const isNewTimeWindow = currInterval === undefined || timeWindow !== intervals[0].timeWindow
            if (isNewTimeWindow) {
                if (currInterval !== undefined) {
                    finishInterval(currInterval);
                }
                currInterval = {
                    prices: [],
                    timeWindow: timeWindow
                }
                intervals.unshift(currInterval)
            }
            // noinspection JSObjectNullOrUndefined
            currInterval.prices.push(tick.price)
        }
        if (intervals.length > 0) {
            finishInterval(intervals[0])
        }
        //return intervals;
        //     x: new Date(1538874000000),
        //     y: [6600.55, 6605, 6589.14, 6593.01]
        let data1 = intervals.map(({timeWindow, open, high, low, close}) => ({
            x: timeWindow * timeInterval,
            y: [open, high, low, close]
        }));
        console.log("new intervals are", data1)
        return data1
    }, [ticks])

    const marketEventHandlers = {
        'gameJoin': ({name: party}) => {
            console.log('joined', parties, party);
            setParties((parties) => [...parties, party])
        },
        'erroneousAction': ({message}) => {
            setError("There was an error performing that last task. Message" + message)
        }, 'youJoined': (playerData) => {
            if (!joined) {
                setJoined(true);
            }
        },
        'gameView': ({gameName, gameMinutes, parties}) => {
            setParties(parties)
            setGameName(gameName)
            setGameMinutes(gameMinutes)
        }, 'playerDataUpdate': (updatedPlayerData) => {
            setPlayerData((playerData) => {
                let playerDataCopy = {...playerData};
                playerDataCopy[updatedPlayerData.name] = updatedPlayerData;
                console.log("new player data is ", playerDataCopy)
                return playerDataCopy;
            })
        }, 'onTick': (newTick) => {
            /*if (seenTransaction(newTick)) {
                return;
            }*/

            setTicks((ticks) => {
                    console.log("ticks are", ticks);
                    return [...ticks, newTick]
                }
            )
        }
    }

    const onJoinedHandlers = {
        'orderInsert': (order) => {
            console.log("order came in ", order)
            /*if (seenTransaction(order)) {
                // AAAAAAHa
                return;
            }*/
            const orderAddFunction = (orders) => {
                const newOrders = [...orders, order]
                newOrders.sort(orderSortFunction);
                console.log("after insert, ", orders)
                return newOrders;
            }

            const publicOrderList = (order.isBid ? setBids : setAsks);
            if (order.name === name) {
                setMyOutStandingOrders(orderAddFunction)
            }
            publicOrderList(orderAddFunction)
        }, 'gameState': ({gameName, gameMinutes, gameId, parties, bids, asks, ticks, playerData, tickSize=0.1}) => {
            console.log("Initial game state", {gameName, gameMinutes, gameId, parties, bids, asks, ticks, playerData, tickSize})
            setParties(parties)
            setBids(bids)
            setAsks(asks)
            setTickSize(Number(tickSize))
            setMyOutStandingOrders((orders) => {
                return [...orders, ...bids.filter((bid) => bid.name === name), ...asks.filter((ask) => ask.name === name)]
            })
            setGameName(gameName)
            setGameMinutes(gameMinutes)
            setTicks(ticks)
            setPlayerData((oldPlayerData) => {
                let playerDataCopy = {...playerData, ...oldPlayerData};
                console.log("new player data is ", playerDataCopy)
                return playerDataCopy;
            })
            console.log('state set');
        }, 'orderUpdate': (newOrder) => {
            const orderAddFunction = ((orders) => {
                /*
                    for (let i = 0; i < orders.length; i++) {
                    if (orders[i].orderId === newOrder.orderId) {
                        if (newOrder.volume === 0) {
                            orders.splice(i,1);
                        } else {
                            orders[i] = newOrder
                        }
                        break
                    }
                }*/
                const retOrders = [...orders]

                for (let i = 0; i < retOrders.length; i++) {
                    if (retOrders[i].orderId === newOrder.orderId) {
                        if (newOrder.volume !== 0) {
                            retOrders[i] = newOrder
                        } else {
                            retOrders.splice(i, 1)
                        }
                        break;
                    }
                }
                console.log("orders after update ", retOrders)
                return retOrders;
            })

            const publicOrderList = (newOrder.isBid ? setBids : setAsks);
            if (newOrder.name === name) {
                setMyOutStandingOrders(orderAddFunction)
            }
            publicOrderList(orderAddFunction)
        }
    }

    useEffect(() => {
        if (replayData) {
            let i = 0
            marketEventHandlers['youJoined']()
            setInterval(() => {
                if (i >= replayData.length) {
                    return;
                }
                const [event, data] = replayData[i]
                onJoinedHandlers[event]?.(data)
                marketEventHandlers[event]?.(data)
                console.log("emitting ", event, data)
                i++
            }, 700)

            return;
        }
        socket.connect()

        Object.entries(marketEventHandlers)
            .forEach(([event, handler]) =>
                socket.on(event, handler))

        socket.emit('viewGame', gameId);
    }, [])

    // Stuff that requires game state
    useEffect(() => {
        if (!joined || replayData) {
            return;
        }
        Object.entries(onJoinedHandlers)
            .forEach(([event, handler]) =>
                socket.on(event, handler))

    }, [joined])

    const submitOrder = (price, volume, orderType) => {
        if (volume === 0 || price === 0) {
            return;
        }
        const isBid = volume > 0
        const order = {price, volume: isBid ? volume : -volume, isBid, orderType};
        console.log("submitting order", order)
        socket.emit('insertOrder', order);
    }

    const submitName = () => {
        socket.emit("joinGame", name);
    }

    const cancelOrderById = (id) => {
        socket.emit("cancelOrder", id)
    }
    const yourPlayerData = useMemo(() => {
        return playerData[name];
    }, [joined, playerData])

    const standingBidVol = useMemo(() => {
        return myOutstandingOrders.reduce((sum, {volume, isBid}) => sum + (isBid ? volume : 0), 0)
    }, [myOutstandingOrders])

    const standingAskVol = useMemo(() => {
        return myOutstandingOrders.reduce((sum, {volume, isBid}) => sum + (!isBid ? volume : 0), 0)
    }, [myOutstandingOrders])

    const [price, setPrice] = useState(0);

    //let alert = useAlert();

    const placeDimeBid = () => {
        const {price, volume} = bids[bids.length - 1]
        submitOrder(Number(price) + tickSize, 1, "dime")
    }

    const placeDimeAsk = () => {
        const {price, volume} = asks[0]
        submitOrder(Number(price) - tickSize, -1, "dime")
    }

    const pullOrders = () => {
        console.log("pull orders requested")
        socket.emit("pullOrders")
    }


    const JoinedMarket = useCallback(() => {

        /*const Order = ({price,volume}) => {
            return <div style={{display:"flex", flexDirection:'row', background:"white"}}><h3>Price: {price} Volume: {volume}</h3></div>
        }
        const OutstandingOrders = () => {
            return <></>
            return <TradeDialog style={{background:themeOptions.palette.secondary.dark, width:'100%', height:50, flex:1}}>
                <CardContent>
                    <h3>
                        Outstanding Orders
                    </h3>
                    {myOutstandingOrders.map((order) => Order(order))}
                </CardContent>
            </TradeDialog>
        }*/
    })
    const exampleMarketData = [{date: new Date().getTime(), open: 3, high: 5, low: 2, close: 2},
        {date: new Date().getTime(), open: 3, high: 5, low: 2, close: 2}]

    return (
        <MuiThemeProvider theme={themeOptions}>
            <div style={{width: width || '100%', height: height || '100%'}}>
                {!joined ?
                    <TradeDialog style={{
                        display: "flex",
                        margin: "auto",
                        marginTop: 50,
                        flexDirection: "column",
                        width: 300,
                        padding: 35
                    }}>
                        <h2 style={{marginBottom: '10', width: 280}}>{`Joining market on ${gameName}`}</h2>
                        <h3>{`It will last ${gameMinutes} minutes`}</h3>
                        <br/>
                        <p>
                            Current players
                        </p>
                        <div style={{
                            display: "flex",
                            marginTop: 10,
                            flexWrap: "wrap",
                            justifyContent: "space-around",
                            alignItems: "center"
                        }}>
                            {Object.values(parties).map((name) => (
                                <PlayerChip name={name}/>
                            ))}
                        </div>
                        <TextField value={name} style={{marginTop: 30}} onChange={(val) => setName(val.target.value)}
                                   label={`Joining market as`}/>
                        {
                            name ? <>
                                <div style={{
                                    display: "flex",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    marginTop: 30
                                }}>
                                    <div style={{flex: 1}}/>
                                    <Button onClick={() => submitName()}>
                                        Joining Market as
                                    </Button>
                                    <PlayerChip name={name}/>
                                </div>
                            </> : []
                        }


                    </TradeDialog>
                    : <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
                        <div style={{display: "flex", flexDirection: 'row', height: "100%", flexWrap: "wrap"}}>
                            <div style={{
                                display: "flex",
                                flex: 7,
                                flexDirection: "column",
                                height: "auto",
                                minHeight: 700,
                                flexBasis: "700px"
                            }}>
                                <div style={{flex: 2, display: "block", width: "100%"}}>
                                    <div style={{margin: 20, height: "100%"}}><Chart options={{
                                        chart: {
                                            type: 'candlestick',
                                            height: "100%",
                                            width: "100%",
                                            animations: {
                                                enabled: false,
                                                dynamicAnimation: {
                                                    enabled: false,
                                                }
                                            }

                                        },
                                        title: {
                                            text: gameName,
                                            align: 'left'
                                        },
                                        xaxis: {
                                            type: 'datetime'
                                        },
                                        yaxis: {
                                            tooltip: {
                                                enabled: false
                                            }
                                        }
                                    }} height={"100%"} series={[{
                                        data: stockData
                                    }]} type="candlestick"/>
                                    </div>
                                </div>
                                <div style={{padding: 20, paddingLeft: 50, flex: 1.4, display: "flex"}}>
                                    <PlayerDataDiag playerData={Object.values(playerData)}/>
                                </div>
                            </div>
                            <div style={{display: "flex", flexDirection: 'column'}}>
                                <OrderBook {...{
                                    bids,
                                    asks,
                                    name,
                                    socket,
                                    cancelOrderById,
                                    placeDimeBid,
                                    placeDimeAsk,
                                    pullOrders,
                                    youHaveOutstandingOrders: myOutstandingOrders.length > 0,
                                    asksExist: asks.length > 0,
                                    bidsExist: bids.length > 0,
                                }} setActivePrice={setPrice}/>
                                <br/>
                                <span style={{color: "white"}}>{error}</span>
                                <OrderWindow {...{
                                    price,
                                    setPrice,
                                    name,
                                    standingAskVol,
                                    standingBidVol,
                                    yourPlayerData,
                                    submitOrder
                                }} />
                            </div>
                            <div style={{flex: 0.1}}/>
                            <TickBook ticks={ticks} name={name}/>
                        </div>
                    </div>
                }
            </div>
        </MuiThemeProvider>)
}


export default Market;