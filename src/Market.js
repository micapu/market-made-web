import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {io} from "socket.io-client";
import {useParams} from "react-router-dom";
import {
    Button,
    Card,
    CardContent,
    Chip,
    MuiThemeProvider,
    Slide,
    Slider,
    Snackbar,
    TextField,
    Tooltip,
    withStyles,
} from "@material-ui/core";
import {useTimer} from 'react-timer-hook';

import {themeOptions} from "./colors";
import Chart from "react-apexcharts";
import {CardTitle} from "reactstrap";
import LogoutIcon from '@mui/icons-material/Logout';
import {Alert} from "@mui/material";


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

    return <Card {...props} elevation={20}>
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
    return <Chip style={props.style} size={"small"} {...props} label={props.label || getShortname(props.name)}/>
}

function PriceVolume(props) {
    const {
        price, volume, sendIoc, partyOrderInfo, name, filledPercent, tickDecimals, onClick = () => {
        }, cancelOrderById, hoverAble = true, background = 'transparent', backgroundWidth = 1
    } = props;
    const paddingRight = 15;
    const [isShown, setIsShown] = useState(false);
    const height = 30;
    const backgroundWidthPercentage = (backgroundWidth * 100).toString() + '%'
    return <div style={{position: 'relative', cursor: "pointer"}}>
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
            <div style={{display: "flex", overflow: "hidden", flex: 1}}>
                {partyOrderInfo !== undefined ? partyOrderInfo.map((partyOrderInfo) => (
                    <PlayerOrderChip partyOrderInfo={partyOrderInfo} name={name} key={partyOrderInfo.orderId}
                                     filledPercent={filledPercent}
                                     cancelOrder={() => cancelOrderById(partyOrderInfo.orderId)}/>
                )) : []}</div>
            <div style={{display: "flex", flex: 1.5, flexDirection: "row", justifyContent: "space-between"}}>
                <div style={{justifyContent: "right", marginLeft: "auto", paddingRight}}>
                    ${price.toFixed(tickDecimals)}
                </div>
                <div style={{justifyContent: "right", marginLeft: "auto", paddingRight}}>
                    {volume}
                </div>
                <Button onClick={() => {
                    sendIoc(price, volume)
                }}> Take </Button></div>
        </div>
    </div>
}

// todo these are grim, especially adding parameters. Make good
function Bid(props) {
    const {
        price,
        volume,
        onClick,
        sendIoc,
        cancelOrderById,
        backgroundWidth,
        partyOrderInfo,
        yourFilledPercent,
        name,
        tickDecimals
    } = props;

    return <PriceVolume  {...{
        price,
        volume,
        partyOrderInfo,
        sendIoc: (price, volume) => sendIoc(price, -volume),
        name,
        onClick,
        tickDecimals,
        cancelOrderById,
        filledPercent: yourFilledPercent,
        background: themeOptions.palette.buy,
        backgroundWidth
    }}/>
}

function Ask(props) {
    const {
        price,
        volume,
        onClick,
        sendIoc,
        cancelOrderById,
        backgroundWidth,
        partyOrderInfo,
        yourFilledPercent,
        name,
        tickDecimals
    } = props;

    return <PriceVolume  {...{
        price,
        volume,
        partyOrderInfo,
        sendIoc,
        name,
        onClick,
        tickDecimals,
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

    return Object.entries(pricePoints).sort(([k, order1], [k2, order2]) => Number(k) - Number(k2))
        .map(([k, orders]) => {
            orders.sort(orderSortFunction)
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
        tickDecimals,
        name,
        cancelOrderById,
        sendIoc,
        placeDimeBid,
        placeDimeAsk,
        pullOrders,
        youHaveOutstandingOrders,
        bidsExist,
        asksExist
    } = props;
    const OrderBookHeaders = () => (
        <div style={{display: "flex", flexDirection: "row", marginTop: 5, marginBottom: 5}}>
            <span style={{flex: 1}}>Price</span>
            <span style={{flex: 1}}>Total</span>
        </div>
    )
    const totalAskVolume = Math.max(5, asks.reduce((i, {volume}) => volume + i, 0))
    const totalBidVolume = Math.max(5, bids.reduce((i, {volume}) => volume + i, 0))
    return <TradeDialog style={props.style}>
        <h2>
            Order Book
        </h2>
        <OrderBookHeaders/>
        <div style={{
            display: "flex",
            position: "relative",
            overflow: "hidden",
            flexDirection: "column",
            maxHeight: "40%",
            marginTop: "auto",
            flex: 1
        }}>
            <div style={{flex: 1}}/>
            <div style={{
                display: "flex",
                position: "absolute",
                bottom: 0,
                right: 0,
                left: 0,
                flexDirection: "column-reverse",
                justifyContent: "flex-end"
            }}>
                {aggregateOrders(asks)
                    .map((ask) => (
                        <Ask {...ask} name={name} key={ask.orderId} cancelOrderById={cancelOrderById}
                             tickDecimals={tickDecimals} sendIoc={sendIoc}
                             backgroundWidth={ask.volume / totalAskVolume} onClick={() => setActivePrice(ask.price)}/>
                    ))}
            </div>
        </div>
        <OrderBookControls style={{margin: 10, width: "100%"}} {...{
            placeDimeAsk,
            placeDimeBid,
            pullOrders,
            youHaveOutstandingOrders,
            bidsExist,
            asksExist
        }}/>
        <div style={{marginBottom: "auto", overflow: "hidden", flex: 1}}>
            <div style={{display: "flex", height: "100%", flexDirection: "column-reverse", justifyContent: "flex-end"}}>
                {aggregateOrders(bids).map((bid) => (
                    <Bid {...bid} name={name} key={bid.orderId} cancelOrderById={cancelOrderById}
                         tickDecimals={tickDecimals} sendIoc={sendIoc}
                         backgroundWidth={bid.volume / totalBidVolume} onClick={() => setActivePrice(bid.price)}/>
                ))}

            </div>
            <div style={{flex: 1}}/>

        </div>
        <OrderBookHeaders/>
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

    const maxSell = -maxPosition + standingAskVol - yourPosition
    const maxBuy = maxPosition - standingBidVol - yourPosition;

    let cappedVolume = Math.min(Math.max(volume, maxSell), maxBuy);
    if (cappedVolume !== volume) {
        setVolume(cappedVolume)
    }
    return <TradeDialog style={props.style}>
        <h2>
            Place an Order
        </h2>
        <div style={{
            display: "flex",
            flexDirection: 'column',
            height: 240,
            padding: 30,
            width: "100%",
            alignItems: 'center'
        }}>
            <TextField type="number" label={"Price"} style={{width: 200}} value={price}
                       onChange={(e) => setPrice(e.target.value)}/>
            <p style={{width: 200, fontSize: 17, marginTop: 10}}
            >Volume {Math.abs(Number(volume))} </p>
            {
                // Was a buy sell slider for an attempt at a gradient, idk if still wanna try that
            }
            <Slider
                defaultValue={0}
                step={1}
                max={maxBuy}
                min={maxSell}
                marks={[{value: 0, label: "0"}, {value: maxSell, label: maxSell}, {value: maxBuy, label: maxBuy}]}
                value={volume}
                style={{marginTop: "auto", display: 'block', width: "80%", maxWidth: 500, marginBottom: 30}}
                onChange={(event, newValue) => setVolume(newValue)}>
            </Slider>
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

function PricePoint(props) {
    const {price, volume} = props;
    return <div>{volume}@${price}</div>
}

function Tick(newTick) {
    const {price, volume, name, buyer, seller, bidWasAggressor, tickDecimals} = newTick
    const setOpacity = (hex, alpha) => `${hex}${Math.floor(alpha * 255).toString(16).padStart(2, 0)}`;
    return <div style={{
        display: "flex",
        justifyContent: "center",
        background: setOpacity(bidWasAggressor ? themeOptions.palette.buy : themeOptions.palette.sell, 0.2)
    }}>
        <PlayerOrderChip partyOrderInfo={{name: buyer}} transparent={true} name={name}/>
        <div style={{display: "flex", flex: 0.7, justifyContent: "center", marginLeft: "auto", marginRight: "auto"}}>
            <PricePoint price={price.toFixed(tickDecimals)} volume={volume}/></div>
        <PlayerOrderChip partyOrderInfo={{name: seller}} transparent={true} name={name}/>
    </div>
}

function TickBook(props) {
    const {ticks, name, tickDecimals, hoverPlayer, playerClear} = props
    return <TradeDialog style={{display: "flex", flexDirection: "column", ...props.style}}>
        <CardContent>
            <h3>
                Ticks
            </h3>
            <PlayerChip name={hoverPlayer} onDelete={playerClear}
                        style={{...(hoverPlayer ? {} : {visibility: "hidden"})}}/>
        </CardContent>
        <div style={{display: "flex", flexDirection: "column", flex: 1, overflow: "auto"}} id={"style-1"}>
            {ticks.filter(({
                               buyer,
                               seller
                           }) => !hoverPlayer || buyer === hoverPlayer || seller === hoverPlayer).reverse().map((newTick) =>
                <Tick key={newTick.tickId} {...newTick} tickDecimals={tickDecimals} name={name}/>)}
        </div>
    </TradeDialog>;
}

function safeDiv(n, d) {
    if (d === 0) {
        return 0;
    }
    return n / d
}

const fractionDigits = 2;

function Player(props: {}) {
    const {playerData, position, name} = props
    console.log("playerdata in player is ", props)
    const averagePrice = Math.abs(safeDiv(playerData.longPosition + playerData.shortPosition, playerData.totalLongVolume + playerData.totalShortVolume));
    return <Card style={{
        width: 200,
        height: 150, ...(playerData.name === name ? {background: themeOptions.palette.primary.mainAccented} : {})
    }}>
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
            <span>${Math.abs(playerData.scrapeValue).toFixed(2)}</span>
            <img
                style={{display: "inline-block", height: 17, width: 17, marginTop: 2}}
                src={playerData.scrapeValue > 0 ?
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
                Position Δ{Math.round(playerData.totalLongVolume - playerData.totalShortVolume)}
                <br/>
                Avg. Price ${averagePrice.toFixed(fractionDigits)}
                <br/>
                <span style={{fontSize: 20}}>#{position}</span>

            </span>
        </div>
    </Card>;
}

function PlayerDataDiag(props) {
    const {playerData, name} = props
    return <TradeDialog id={"style-1"} style={{overflow: "auto", padding: 10, ...props.style}}>
        <div style={{
            height: "auto", width: "100%",
            flexBasis: 400, display: "flex",
            flexWrap: "wrap",
            maxHeight: "300px",
            justifyContent: "space-around"
        }}>
            {playerData.sort(({scrapeValue: scrapeValue1}, {scrapeValue: scrapeValue2}) => scrapeValue2 - scrapeValue1).map((playerData, i) => (
                <Player playerData={playerData} position={i + 1} name={name}/>
            ))}
        </div>
    </TradeDialog>;
}

// sorts orders by time then by id (guaranteed to increase with time)
// wait why didn't I just sort by id?
function orderSortFunction({price: price1, orderId: orderId1}, {price: price2, orderId: orderId2}) {
    price1 = Number(price1)
    price2 = Number(price2)
    return (+(price1 > price2) || +(price1 === price2) - 1) ||
        (+(orderId1 > orderId2) || +(orderId1 === orderId2) - 1)
}

function MarketTimer({expiryTimestamp, fontSize = 25, shortenText = false, onExpire}) {
    const {
        seconds,
        minutes,
        hours,
        days,
        isRunning,
        start,
        pause,
        resume,
        restart,
    } = useTimer({expiryTimestamp, onExpire});
    const digitSpan = (digit) => (
        <span style={{}}>
            {digit.toString().padStart(2, "0")}
        </span>)
    return <div style={{
        display: "flex",
        flexDirection: "row",
        color: "white",
        justifyContent: "center",
        fontSize,
        marginTop: 8,
        marginBottom: 8
    }}>
        {shortenText ? "" : "Remaining "}
        <div style={{width: 10}}></div>
        {digitSpan(hours)}h:{digitSpan(minutes)}m:{digitSpan(seconds, true)}s
    </div>;
}

function isExpired(expiredTimestamp) {
    return new Date() - expiredTimestamp > 0;
}

function MakePlayerResult({setHoverPlayer, hoverPlayer, playerData, index, final, biggestLoser}) {
    const [clicked, setClicked] = useState(false);
    let hover = hoverPlayer === playerData.name
    if (hoverPlayer !== playerData.name && clicked) {
        setClicked(false)
    }
    const profit = safeDiv(playerData.rawProfit, Math.abs(biggestLoser));
    const averagePrice = Math.abs(safeDiv(playerData.longPosition + playerData.shortPosition, playerData.totalLongVolume + playerData.totalShortVolume));
    let background;
    if (hover) {
        background = themeOptions.palette.secondary.dark
    } else if (playerData.rawProfit > 0) {
        background = themeOptions.palette.primary.mainAccented
    } else {
        background = themeOptions.palette.error.accented
    }
    return [
        <Card
            onMouseEnter={() => {
                if (!clicked && !hoverPlayer)
                    setHoverPlayer(playerData.name)
            }}
            onMouseLeave={() => {
                if (!clicked && hoverPlayer === playerData.name)
                    setHoverPlayer("")
            }}
            onClick={() => {
                setClicked(true)
                setHoverPlayer(playerData.name)
            }}
            style={{
                width: 200, height: 150,
                cursor: "pointer", background
            }}>
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
                <span>${profit.toFixed(2)}</span>
                <img
                    style={{display: "inline-block", height: 17, width: 17, marginTop: 2}}
                    src={playerData.rawProfit > 0 ?
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
                Position Δ{Math.round(playerData.totalLongVolume - playerData.totalShortVolume)}
                <br/>
                Avg. Price ${averagePrice.toFixed(fractionDigits)}
                <br/>
                <span style={{fontSize: 20}}>#{index + 1}</span>
            </span>
            </div>
        </Card>, <div style={{width: final ? 0 : 10}}/>];
}

//todo remove that = 0.1
function MarketResults({
                           finalPlayerData,
                           gameName,
                           gameMinutes,
                           expiryTimestamp,
                           name,
                           marketValue: actualMarketValue,
                           ticks,
                           tickDecimals = 0.1
                       }) {
    const [inputtedMarketValue, setInputtedMarketValue] = useState("");
    const [hoverPlayer, setHoverPlayer] = useState("");
    let marketValue = inputtedMarketValue || actualMarketValue
    marketValue = Number(marketValue)
    if (!(finalPlayerData && actualMarketValue && ticks)) {
        return <h1> Loading... </h1>
    }

    let biggestLoser = Number.POSITIVE_INFINITY
    Object.values(finalPlayerData).forEach(playerData => {
        let rawProfitFromBuys = (marketValue * playerData.totalLongVolume) - playerData.longPosition
        let rawProfitFromSells = playerData.shortPosition - (marketValue * playerData.totalShortVolume)
        let rawProfit = rawProfitFromBuys + rawProfitFromSells;
        playerData.rawProfit = rawProfit;
        biggestLoser = Math.min(rawProfit, biggestLoser);
    })

    let index = 0;
    const makePlayerRow = (playerRow) => (
        <div style={{display: "flex", flexDirection: "row", justifyContent: "center", marginTop: 10}}>
            {playerRow.map((p, rowIndex) => <MakePlayerResult hoverPlayer={hoverPlayer} setHoverPlayer={setHoverPlayer}
                                                              playerData={p} index={index++}
                                                              final={rowIndex === playerRow.length - 1}
                                                              biggestLoser={biggestLoser}/>)}
        </div>
    )

    const playerRows = []
    let nextTriangleNumberIndex = 0;
    let triangleWidth = 0;
    Object.values(finalPlayerData).sort(({rawProfit: p1}, {rawProfit: p2}) => p2 - p1).forEach((playerData, index) => {
        if (index === nextTriangleNumberIndex) {
            triangleWidth++;
            nextTriangleNumberIndex = index + triangleWidth;
            playerRows.push([])
        }
        playerRows[playerRows.length - 1].push(playerData)
    })

    return <div style={{display: "flex", flexDirection: "row", width: "100%"}}>
        <div style={{flex: 1}}/>

        <div style={{flex: 1}}>
            <h2 style={{color: "white", marginTop: 20}}>Market over</h2>
            <TradeDialog style={{padding: 15}}>
                <CardTitle>
                    <h3>Market Had A Value Of {actualMarketValue}</h3>
                </CardTitle>
                <CardContent>
                    <TextField label={"Simulate Different Value"} value={inputtedMarketValue}
                               placeholder={actualMarketValue.toString()}
                               onChange={(val) => setInputtedMarketValue(val.target.value)}/>
                </CardContent>
            </TradeDialog>
            <CardContent style={{display: "flex", flexDirection: "column", justifyContent: "center"}}>
                {playerRows.map(makePlayerRow)}
            </CardContent></div>
        <div style={{flex: 1}}/>
        <TickBook {...{
            ticks, name, tickDecimals, hoverPlayer, style: {flex: 1}, playerClear: () => {
                setHoverPlayer()
            }
        }} />
    </div>;
}

const Market = (props) => {
    const {gameId} = useParams();
    const {height, width, replayData} = props;
    const [socket] = useState(() => io(`/ws`, {
//        transports: ['websocket'],
        withCredentials: true,
    }));

    const [error, setError] = useState('');
    const [info, setInfo] = useState('');

    // Game state
    const [name, setName] = useState('');
    const [joined, setJoined] = useState(false);
    const [parties, setParties] = useState([]);
    const [bids, setBids] = useState([])
    const [asks, setAsks] = useState([])
    const [marketOver, setMarketOver] = useState(false)
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
    const [expiryTimestamp, setExpiryTimestamp] = useState()
    const [gameName, setGameName] = useState()
    const [gameMinutes, setGameMinutes] = useState()
    const [tickSize, setTickSize] = useState()
    const [tickDecimals, setTickDecimals] = useState(0)
    const [finalPlayerData, setFinalPlayerData] = useState()
    const [marketValue, setMarketValue] = useState()
    const [finalTicks, setFinalTicks] = useState()
    const stockData = useMemo(() => {
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
        'info': ({message}) => {
            setInfo(message)
        },
        'gameJoin': ({name: party}) => {
            console.log('joined', parties, party);
            setParties((parties) => [...parties, party])
        },
        'erroneousAction': ({message}) => {
            setError("There was an error performing that last task. " + message)
        }, 'youJoined': (playerData) => {
            if (!joined) {
                setJoined(true);
                setName(playerData.name)
            }
        },
        'gameView': ({gameName, gameMinutes, parties, expiryTimestamp, finalPlayerData, finalTicks, marketValue}) => {
            setParties(parties)
            setGameName(gameName)
            setGameMinutes(gameMinutes)
            setExpiryTimestamp(new Date(expiryTimestamp))
            setMarketOver(isExpired(expiryTimestamp))
            setFinalPlayerData(finalPlayerData)
            setMarketValue(Number(marketValue))
            setFinalTicks(finalTicks)
        }, 'playerDataUpdate': (updatedPlayerData) => {
            setPlayerData((playerData) => {
                let playerDataCopy = {...playerData};
                playerDataCopy[updatedPlayerData.name] = updatedPlayerData;
                console.log("new player data is ", playerDataCopy)
                return playerDataCopy;
            })
        }, 'onTick': (newTick) => {
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
        },
        'gameState': ({
                          gameName,
                          gameMinutes,
                          gameId,
                          parties,
                          bids,
                          asks,
                          ticks,
                          playerData,
                          expiryTimestamp,
                          tickSize = 0.1,
                          tickDecimals
                      }) => {
            console.log("Initial game state", {
                gameName,
                gameMinutes,
                gameId,
                parties,
                bids,
                asks,
                ticks,
                playerData,
                tickSize
            })
            setParties(parties)
            setBids(bids.reverse())
            setAsks(asks)
            setTickSize(Number(tickSize))
            setMyOutStandingOrders((orders) => {
                return [...orders, ...bids.filter((bid) => bid.name === name), ...asks.filter((ask) => ask.name === name)]
            })
            setGameName(gameName)
            setGameMinutes(gameMinutes)
            setTicks(ticks)
            setTickDecimals(tickDecimals)
            setPlayerData((oldPlayerData) => {
                let playerDataCopy = {...playerData, ...oldPlayerData};
                console.log("new player data is ", playerDataCopy)
                return playerDataCopy;
            })
            console.log('state set');
        },
        'orderUpdate': (newOrder) => {
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
            marketEventHandlers['youJoined']({name: null})
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

        socket.emit('viewGame', {gameId});
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
        const order = {unsanitizedPrice: price, unsanitizedVolume: isBid ? volume : -volume, isBid, orderType};
        console.log("submitting order", order)
        socket.emit('insertOrder', order);
    }

    const sendIoc = (price, volume) => {
        submitOrder(price, volume, "ioc")
    }

    const submitName = () => {
        socket.emit("joinGame", {name});
    }

    const cancelOrderById = (orderId) => {
        socket.emit("cancelOrder", {orderId})
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
        //todo really simple, if yours just add to it instead of diming
        const {price} = bids[bids.length - 1]
        submitOrder(Number(price) + tickSize, 1, "dime")
    }

    const placeDimeAsk = () => {
        const {price} = asks[0]
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
    const errorContainer = useRef(null)
    const halfMargin = 5;
    const onMarketEnd = () => {
        setMarketOver(true);
        socket.emit("viewGame")
    }
    const lrMargins = {marginLeft: halfMargin, marginRight: halfMargin}
    const tbPaddings = {paddingTop: halfMargin * 2, paddingBottom: halfMargin * 2}
    return (
        <MuiThemeProvider theme={themeOptions}>
            <Snackbar open={error || info} autoHideDuration={6000} onClose={() => {
                setError("");
                setInfo("");
            }} ref={errorContainer}>
                {error ?
                    <Slide direction="up" in={error} container={errorContainer.current}>
                        <Alert severity="error">{error}</Alert>
                    </Slide>
                    : info ?
                        <Slide direction="up" in={info} container={errorContainer.current}>
                            <Alert severity="info">{info}</Alert>
                        </Slide> : undefined}
            </Snackbar>
            {
                marketOver ? <MarketResults finalPlayerData={finalPlayerData}
                                            ticks={finalTicks}
                                            tickDecimals={tickDecimals}
                                            gameName={gameName}
                                            gameMinutes={gameMinutes}
                                            expiryTimestamp={expiryTimestamp}
                                            marketValue={marketValue}
                                            name={name}/> : !joined ?
                    <TradeDialog style={{
                        display: "flex",
                        margin: "auto",
                        marginTop: 50,
                        flexDirection: "column",
                        paddingRight: 35,
                        width: "auto",
                        minWidth: 300,
                        maxWidth: 600,
                        paddingBottom: 35,
                        paddingLeft: 35
                    }}>
                        <h4 style={{marginBottom: 25, alignSelf: "flex-start"}}> Market </h4>
                        <h2 style={{marginBottom: '10'}}>{`${gameName}`}</h2>
                        <h4 style={{marginBottom: 25}}>
                            {expiryTimestamp !== undefined ?
                                <MarketTimer onExpire={onMarketEnd} expiryTimestamp={expiryTimestamp} fontSize={15}
                                             shortenText={true}/> : undefined}
                            remaining of {gameMinutes}m
                        </h4>
                        <h4 style={{marginBottom: 25, alignSelf: "flex-start"}}> Current players </h4>


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
                    :
                    <div style={{width: "100%", height: "100%", display: "flex", flexDirection: "column"}}>
                        <div style={{height: halfMargin}}/>
                        <div style={{
                            display: "flex",
                            flexDirection: 'row',
                            height: "100%",
                            width: "100%",
                            flexWrap: "wrap"
                        }}>
                            <div style={{
                                display: "flex",
                                flex: 3,
                                height: "inherit",
                                flexDirection: "column",
                                minHeight: 350,
                                flexBasis: "400px",
                                ...lrMargins
                            }}>
                                <div style={{flex: 2, display: "block", width: "100%"}}>
                                    <div style={{height: "100%"}}><Chart options={{
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
                                <PlayerDataDiag style={{}} playerData={Object.values(playerData)} name={name}/>
                            </div>
                            <div style={{
                                display: "flex",
                                height: "inherit",
                                flexDirection: 'column',
                                flex: 2,
                                flexBasis: 220,
                                maxWidth: 500, ...lrMargins
                            }}>
                                <OrderBook {...{
                                    bids,
                                    asks,
                                    tickDecimals,
                                    name,
                                    sendIoc,
                                    socket,
                                    cancelOrderById,
                                    placeDimeBid,
                                    placeDimeAsk,
                                    pullOrders,
                                    youHaveOutstandingOrders: myOutstandingOrders.length > 0,
                                    asksExist: asks.length > 0,
                                    bidsExist: bids.length > 0,
                                    style: {display: "flex", flexBasis: 400, flexDirection: "column", flex: 1.5}
                                }} setActivePrice={setPrice}/>
                                {expiryTimestamp !== undefined ?
                                    <MarketTimer onExpire={onMarketEnd} expiryTimestamp={expiryTimestamp}/> : undefined}
                                <OrderWindow {...{
                                    price,
                                    setPrice,
                                    name,
                                    standingAskVol,
                                    standingBidVol,
                                    yourPlayerData,
                                    submitOrder,
                                    style: {flex: 1, display: "flex", flexDirection: "column", alignItems: "center"}
                                }} />
                            </div>
                            <TickBook ticks={ticks} tickDecimals={tickDecimals} name={name} style={{
                                background: themeOptions.palette.secondary.dark,
                                height: "inherit",
                                flex: 0.5,
                                flexBasis: 120, ...lrMargins
                            }}/>
                        </div>
                        <div style={{height: halfMargin}}/>

                    </div>


            }
        </MuiThemeProvider>)
}


export default Market;