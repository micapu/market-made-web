import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {io} from "socket.io-client";
import {useParams} from "react-router-dom";
import {Button, Card, CardContent, MuiThemeProvider, Slider, TextField, Chip, withStyles} from "@material-ui/core";
import {themeOptions} from "./colors";
import {XAxis, YAxis} from "react-stockcharts/lib/axes";
import {CandlestickSeries} from "react-stockcharts/lib/series";
import discontinuousTimeScaleProvider from "react-stockcharts/lib/scale/discontinuousTimeScaleProvider";
import Chart from "react-apexcharts";
import {CardTitle} from "reactstrap";


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

function PlayerChip(props: {}) {
    const {partyOrderInfo, name, cancelOrder, transparent = false} = props
    let width = 45;
    let filledPercentString = ' ';
    if (partyOrderInfo.volume && partyOrderInfo.originalVolume) {
        let filledPercent = 1 - (partyOrderInfo.volume / partyOrderInfo.originalVolume);
        filledPercentString = " " + Math.round(filledPercent * 100).toString() + "%"
        width += 50;
    }

    let isYou = partyOrderInfo.name === name;
    let variant = !transparent ? "default" : "outlined";
    if (isYou) {
        return <Chip size={"small"} style={{width}} variant={variant} label={"You" + filledPercentString}
                     onDelete={cancelOrder}/>
    }
    return <Chip size={"small"} style={{width}} variant={variant} label={getShortname(partyOrderInfo.name)}/>
}

function PriceVolume(props) {
    const {
        price, volume, partyOrderInfo, name, filledPercent, onClick = () => {
        }, cancelOrder, hoverAble = true, background = 'transparent', backgroundWidth = 1
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
                <PlayerChip partyOrderInfo={partyOrderInfo} name={name} key={partyOrderInfo.orderId}
                            filledPercent={filledPercent} cancelOrder={cancelOrder}/>
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
    const {price, volume, onClick, cancelOrder, backgroundWidth, partyOrderInfo, yourFilledPercent, name} = props;

    return <PriceVolume  {...{
        price,
        volume,
        partyOrderInfo,
        name,
        onClick,
        cancelOrder,
        filledPercent: yourFilledPercent,
        background: themeOptions.palette.buy,
        backgroundWidth
    }}/>
}

function Ask(props) {
    const {price, volume, onClick, cancelOrder, backgroundWidth, partyOrderInfo, yourFilledPercent, name} = props;

    return <PriceVolume  {...{
        price,
        volume,
        partyOrderInfo,
        name,
        onClick,
        cancelOrder,
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

    return Object.entries(pricePoints).sort(([k, v]) => k)
        .map(([k, orders]) => {
            const firstOrder = Object.assign({}, orders[0])

            firstOrder.partyOrderInfo = [{
                name: firstOrder.name,
                originalVolume: firstOrder.originalVolume,
                volume: firstOrder.volume
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

function OrderBook(props) {
    const {bids, asks, setActivePrice, name, cancelOrderById} = props;
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
        <div style={{display: "flex", flexDirection: "column", flex: 1}}>
            <OrderBookHeaders/>
            <div style={{display: "flex", flexDirection: "column-reverse", flex: 1}}>

                {aggregateOrders(asks)
                    .map((ask) => (
                        <Ask {...ask} name={name} key={ask.orderId} cancelOrder={() => cancelOrderById(ask.orderId)}
                             backgroundWidth={ask.volume / totalAskVolume} onClick={() => setActivePrice(ask.price)}/>
                    ))}
            </div>
        </div>

        <div style={{display: "flex", flexDirection: "column", flex: 1}}>
            <div style={{display: "flex", flexDirection: "column-reverse", flex: 1}}>
                {aggregateOrders(bids).map((bid) => (
                    <Bid {...bid} name={name} key={bid.orderId} cancelOrder={() => cancelOrderById(bid.orderId)}
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
        getStandingPosition,
        submitOrder,
        getStandingAskVol,
        getStandingBidVol,
        socket,
        price,
        setPrice,
        name
    } = props;

    const [volume, setVolume] = useState(0);

    const isBid = () => volume > 0;
    const maxSell = -maxPosition + getStandingAskVol()
    const maxBuy = maxPosition - getStandingBidVol();
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
                       onChange={(e) => setVolume(e.target.value)}/>
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
            }} onClick={() => submitOrder(price, volume)}>
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
        <PlayerChip partyOrderInfo={{name: buyer}} transparent={true} name={name}/>
        <div style={{display: "flex", flex: 0.7, justifyContent: "center"}}><PricePoint price={price} volume={volume} /></div>
        <PlayerChip partyOrderInfo={{name: seller}} transparent={true} name={name}/>
    </div>
}

function TickBook(props) {
    const {ticks, name} = props
    return <TradeDialog style={{
        background: themeOptions.palette.secondary.dark,
        width: 2, height: "100%", flex: 1, flexBasis:100
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
    if (d == 0) {
        return 0;
    }
    return n / d
}

function Player(props: {}) {
    const {playerData} = props
    const averageBuy = safeDiv(playerData.longPosition, playerData.totalLongVolume);
    const averageSell = safeDiv(playerData.shortPosition, playerData.totalShortVolume);
    return <Card style={{width:200,height:150}}>
        <CardTitle>
            {getShortname(playerData.name)}
        </CardTitle>
        <div style={{display:"flex",flexDirection:"row", alignItems:"center",width:"100%", justifyContent:"center"}}>
        <span>${playerData.scrapedValue}</span>
        <img
            style={{display:"inline-block", height:17,width:17,marginTop:2}}
            src={true?
                "https://img.icons8.com/ios-glyphs/100/26e07f/sort-up.png" :
                "https://img.icons8.com/ios-glyphs/100/26e07f/sort-down.png"}/>
        </div>
        <div style={{display:"flex",flexDirection:"row", alignItems:"center",width:"100%", justifyContent:"center"}}>
            <span>
                Position : {playerData.totalLongVolume - playerData.totalShortVolume}
                <br />
                Average Buy Price {averageBuy}
                <br />
                Average Sell Price {averageSell}
            </span>
        </div>
    </Card>;
}

function PlayerDataDiag(props) {
    const {playerData} = props
    return <TradeDialog style={{width: "100%"}}>
        <div style={{display:"flex",flexWrap:"wrap", justifyContent:"space-between"}}>
            {playerData.map((playerData) => (
                <Player playerData={playerData} />
            ))}
        </div>
    </TradeDialog>;
}

let time = 1538884800000
let currprice = 6605


function Market(props) {
    const {gameId} = useParams();
    const [socket, setSocket] = useState(() => io("ws://127.0.0.1:3000/game", {
        withCredentials: true,
    }));

    const [error, setError] = useState('');

    // Game state
    const [name, setName] = useState('');
    const nameRef = useRef(name);
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

    useEffect(() => {
        socket.connect()

        socket.on('gameJoin', (party) => {
            console.log('joined', parties, party);
            setParties((parties) => [...parties, party])
        })

        socket.on('erroneousAction', ({message}) => {
            setError("There was an error performing that last task. Message" + message)
        })

        socket.on('orderInsert', (order) => {
            console.log("order came in ", order)
            if (seenTransaction(order)) {
                // AAAAAAHa
                return;
            }
            const orderAddFunction = (orders) => {
                const newOrders = [...orders, order]
                newOrders.sort(({price: price1}, {price: price2}) => price1 - price2)
                return newOrders;
            }

            const publicOrderList = (order.isBid ? setBids : setAsks);
            if (order.name === nameRef.current) {
                setMyOutStandingOrders(orderAddFunction)
            }
            publicOrderList(orderAddFunction)
        })

        socket.on('gameState', ({gameName, gameMinutes, gameId, parties, bids, asks, ticks, playerData}) => {
            setParties(parties)
            setBids(bids)
            setAsks(asks)
            setTicks(ticks)
            setPlayerData(playerData)
            console.log('state set');
        })

        socket.on('playerDataUpdate', (updatedPlayerData) => {
            setPlayerData((playerData) => {
                let playerDataCopy = Object.assign({}, playerData);
                playerDataCopy[updatedPlayerData.name] = updatedPlayerData;
                console.log("new player data is ", playerDataCopy)
                return playerDataCopy;
            })
        })

        socket.on('onTick', (newTick) => {
            if (seenTransaction(newTick)) {
                return;
            }
            setTicks((ticks) => [...ticks, newTick])
            console.log("ticks are", ticks);
        })

        socket.on('orderUpdate', (newOrder) => {

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
                const newOrderList = newOrder.volume === 0 ? [] : [newOrder]
                return [...orders.filter(({orderId: iterOrderId}) => iterOrderId !== newOrder.orderId), ...newOrderList]
                    .sort(({price: price1}, {price: price2}) => price1 - price2);
            })

            const publicOrderList = (newOrder.isBid ? setBids : setAsks);
            if (newOrder.name === nameRef.current) {
                setMyOutStandingOrders(orderAddFunction)
            }
            publicOrderList(orderAddFunction)
        })
    }, [])


    const submitOrder = (price, volume) => {
        if (volume === 0 || price === 0) {
            return;
        }
        const isBid = volume > 0
        const order = {price, volume: isBid ? volume : -volume, isBid};
        console.log("submitting order", order)
        socket.emit('insertOrder', order);
    }

    const submitName = () => {
        socket.emit("joinGame", gameId, name);
        setJoined(true);
    }

    const cancelOrderById = (id) => {
        socket.emit("cancelOrder", id)
    }

    const getStandingBidVol = useCallback(() => {
        return myOutstandingOrders.reduce((sum, {volume, isBid}) => sum + (isBid ? volume : 0), 0)
    })

    const getStandingAskVol = useCallback(() => {
        return myOutstandingOrders.reduce((sum, {volume, isBid}) => sum + (!isBid ? volume : 0), 0)
    }, [myOutstandingOrders])

    const [price, setPrice] = useState(0);

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
    const data = [{date: new Date().getTime(), open: 3, high: 5, low: 2, close: 2},
        {date: new Date().getTime(), open: 3, high: 5, low: 2, close: 2}]

    return (
        <MuiThemeProvider theme={themeOptions}>
            <div style={{width: '100%', height: '100%'}}>
                {!joined ?
                    <TradeDialog style={{
                        display: "flex",
                        margin: "auto",
                        marginTop: 50,
                        flexDirection: "column",
                        width: 300,
                        padding: 50
                    }}>
                        <h2 style={{margin: 10}}>Please write your name</h2>
                        <TextField value={name} onChange={(val) => setName(val.target.value)}
                                   label="Joining market as"/>
                        <Button style={{marginTop: 30}} onClick={() => submitName()}>
                            Join Market
                        </Button>
                    </TradeDialog>
                    : <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
                        <div style={{display: "flex", flexDirection: 'row', height: "100%", flexWrap:"wrap"}}>
                            <div style={{display: "flex", flex:7, flexDirection: "column", height: "auto", minHeight:700, flexBasis:"900px"}}>
                                <div style={{flex:2, display:"block", width:"100%"}}
                                ><div style={{margin:20,height:"100%"}}><Chart options={{
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
                                        text: 'CandleStick Chart',
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
                                }} height={"100%"}  series={[{
                                    data: stockData
                                }]} type="candlestick"/>
                                </div>
                                </div>
                                <div style={{padding: 20, paddingLeft: 50, flex: 1.4, display: "flex"}}>
                                    <PlayerDataDiag playerData={Object.values(playerData)}/>
                                </div>
                            </div>
                            <div style={{display: "flex", flexDirection: 'column'}}>
                                <OrderBook {...{bids, asks, name, socket, cancelOrderById}} setActivePrice={setPrice}/>
                                <br/>
                                <span style={{color: "white"}}>{error}</span>
                                <OrderWindow {...{
                                    price,
                                    setPrice,
                                    name,
                                    getStandingAskVol,
                                    getStandingBidVol,
                                    submitOrder
                                }} />
                            </div>
                            <div style={{flex: 0.05}}/>
                            <TickBook ticks={ticks} name={name}/>
                        </div>
                    </div>
                }
            </div>
        </MuiThemeProvider>)
}


export default Market;