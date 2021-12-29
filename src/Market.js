import React, {useEffect, useMemo, useRef, useState} from 'react';
import {io} from "socket.io-client";
import {useParams} from "react-router-dom";
import {
    Button,
    Card,
    CardContent,
    Chip,
    IconButton,
    InputAdornment,
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
import AssignmentIcon from '@material-ui/icons/Assignment';
import HomeIcon from '@material-ui/icons/Home';
import AssignmentTurnedInIcon from '@material-ui/icons/AssignmentTurnedIn';
import GetUUID from "./GetUUID";


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
        price, volume, sendIoc, partyOrderInfo, name, filledPercent, onClick = () => {
        }, unitDetails, cancelOrderById, hoverAble = true, background = 'transparent', backgroundWidth = 1
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
                    {createUnit(price, unitDetails.tickDecimals, unitDetails)}
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
        unitDetails
    } = props;

    return <PriceVolume  {...{
        price,
        volume,
        partyOrderInfo,
        sendIoc: (price, volume) => sendIoc(price, -volume),
        name,
        onClick,
        unitDetails,
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
        unitDetails,
    } = props;

    return <PriceVolume  {...{
        price,
        volume,
        partyOrderInfo,
        sendIoc,
        name,
        onClick,
        unitDetails,
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
        unitDetails,
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
            marginTop: "auto",
            flex: 1
        }}>
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
                             unitDetails={unitDetails} sendIoc={sendIoc}
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
        <div style={{marginBottom: "auto", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden"}}>
            <div style={{display: "flex", height: "100%", flexDirection: "column-reverse", justifyContent: "flex-end"}}>
                {aggregateOrders(bids).map((bid) => (
                    <Bid {...bid} name={name} key={bid.orderId} cancelOrderById={cancelOrderById}
                         unitDetails={unitDetails} sendIoc={sendIoc}
                         backgroundWidth={bid.volume / totalBidVolume} onClick={() => setActivePrice(bid.price)}/>
                ))}

            </div>

        </div>
        <OrderBookHeaders/>
    </TradeDialog>
}

function OrderWindow(props) {
    const {
        submitOrder,
        standingAskVol,
        unitDetails,
        standingBidVol,
        yourPlayerData,
        socket,
        price,
        setPrice,
        name
    } = props;

    const [volume, setVolume] = useState(0);

    const isBid = volume > 0;
    const hasVol = volume !== 0
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
            height: 200,
            padding: 30,
            width: "100%",
            alignItems: 'center'
        }}>
            <TextField type="number" label={"Order"} style={{}} value={price}
                       sx={{m: 1, width: '25ch'}}
                       InputProps={{
                           startAdornment: <InputAdornment style={{color: "rgba(255, 255, 255, 0.7)"}}
                                                           position="start">{volume}@{unitDetails.unitPrefix}</InputAdornment>,
                           endAdornment: <InputAdornment position="start">{unitDetails.unitSuffix}</InputAdornment>,
                       }}
                       onChange={(e) => setPrice(e.target.value)}/>
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
                width: "13em",
                marginBottom: 20, ...(isBid ? {} : {
                    backgroundColor: themeOptions.palette.sell,
                    color: "white"
                })

            }} disabled={!hasVol} onClick={() => submitOrder(price, volume, "limit")}>
                {hasVol ? (isBid ? "Place Bid" : "Place Offer") : "Select Volume"}
            </Button>
        </div>
    </TradeDialog>
}

const maxPosition = 20

function PricePoint(props) {
    const {price, volume} = props;
    return <div>{volume}@{price}</div>
}

function Tick(newTick) {
    const {price, volume, name, buyer, seller, bidWasAggressor, unitDetails} = newTick
    const setOpacity = (hex, alpha) => `${hex}${Math.floor(alpha * 255).toString(16).padStart(2, 0)}`;
    return <div style={{
        display: "flex",
        justifyContent: "center",
        background: setOpacity(bidWasAggressor ? themeOptions.palette.buy : themeOptions.palette.sell, 0.2)
    }}>
        <PlayerOrderChip partyOrderInfo={{name: buyer}} transparent={true} name={name}/>
        <div style={{display: "flex", flex: 0.7, justifyContent: "center", marginLeft: "auto", marginRight: "auto"}}>
            <PricePoint price={createUnit(price, unitDetails.tickDecimals, unitDetails)} volume={volume}/></div>
        <PlayerOrderChip partyOrderInfo={{name: seller}} transparent={true} name={name}/>
    </div>
}

function TickBook(props) {
    const {ticks, name, unitDetails, hoverPlayer, playerClear} = props
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
                <Tick key={newTick.tickId} {...newTick} unitDetails={unitDetails} name={name}/>)}
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

function createUnit(value, decimals, {unitSuffix, unitPrefix}) {
    return ((unitPrefix || "") + value.toFixed(decimals) + (unitSuffix || ""))
}

function Player(props: {}) {
    const {playerData, rank, name, unitDetails} = props
    const averagePrice = Math.abs(safeDiv(playerData.longPosition + playerData.shortPosition, playerData.totalLongVolume + playerData.totalShortVolume));
    let delta = playerData.totalLongVolume - playerData.totalShortVolume;
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
            <span>${Math.abs(playerData.scalpValue).toFixed(2)}</span>
            <img
                style={{display: "inline-block", height: 17, width: 17, marginTop: 2}}
                src={playerData.scalpValue > 0 ?
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
                Position {delta < 0 ? "-" : ""}Δ{Math.round(Math.abs(delta))}
                <br/>
                Avg. Price {createUnit(averagePrice, 2, unitDetails)}
                <br/>
                <span style={{fontSize: 20}}>#{rank}</span>

            </span>
        </div>
    </Card>;
}

function PlayerDataDiag(props) {
    const {playerData, name, unitDetails, exposureDetails} = props
    return <TradeDialog id={"style-1"} style={{overflow: "auto", padding: 10, ...props.style}}>
        <div style={{
            height: "auto", width: "100%",
            flexBasis: 400, display: "flex",
            flexWrap: "wrap",
            maxHeight: "300px",
            justifyContent: "space-around"
        }}>
            {playerData.sort(({scalpValue: scalpValue1}, {scalpValue: scalpValue2}) => scalpValue2 - scalpValue1).map((playerData, i) => (
                <Player playerData={playerData} rank={i + 1} name={name} unitDetails={unitDetails} minScalpedValue/>
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

    if (expiryTimestamp === null) {
        return <h2 style={{color: "white"}}>Waiting For Start</h2>
    }

    let marketOver = new Date(expiryTimestamp) < new Date()
    let color = minutes === 0 && hours === 0 && days === 0 && !marketOver ? (seconds % 3 === 0 ? "red" : "white") : "white"
    const digitSpan = (digit, suffix) => (
        digit > 0 ?
            <span style={{}}>
            {digit.toString().padStart(2, "0")}{suffix}
        </span> : undefined
    )
    return <div style={{
        display: "flex",
        flexDirection: "row",
        color,
        marginLeft: "auto", marginRight: "auto",
        justifyContent: "center",
        fontSize,
        marginTop: 8,
        marginBottom: 8
    }}> {marketOver ? "Market Over" :
        [digitSpan(hours, "h"), digitSpan(minutes, "m"), digitSpan(seconds, "s"),
            <div style={{width: 10}}/>, shortenText ? "" : "remaining "]}


    </div>;
}

function isExpired(expiredTimestamp) {
    return expiredTimestamp && new Date() - expiredTimestamp > 0;
}

function MakePlayerResult({
                              setHoverPlayer,
                              hoverPlayer,
                              playerData,
                              index,
                              final,
                              biggestLoser,
                              exposureDetails: {gameExposure, exposureCurrency}
                          }) {
    const [clicked, setClicked] = useState(false);
    let hover = hoverPlayer === playerData.name
    if (hoverPlayer !== playerData.name && clicked) {
        setClicked(false)
    }
    const profit = safeDiv(playerData.rawProfit, Math.abs(biggestLoser)) * gameExposure;
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
                <span>{exposureCurrency}{profit.toFixed(2)}</span>
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
                           imHost,
                           exposureDetails,
                           name,
                           submitMarketValue,
                           marketValue: actualMarketValue,
                           unitDetails,
                           ticks,
                       }) {
    const [inputtedMarketValue, setInputtedMarketValue] = useState("");
    const [hoverPlayer, setHoverPlayer] = useState("");

    let marketValue = inputtedMarketValue !== '' ? Number(inputtedMarketValue) : actualMarketValue
    if (actualMarketValue !== null) {
        actualMarketValue = Number(actualMarketValue)
    }
    if (!(finalPlayerData && ticks && exposureDetails)) {
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
            {playerRow.map((p, rowIndex) => <MakePlayerResult hoverPlayer={hoverPlayer}
                                                              setHoverPlayer={setHoverPlayer}
                                                              playerData={p} index={index++}
                                                              final={rowIndex === playerRow.length - 1}
                                                              biggestLoser={biggestLoser}
                                                              exposureDetails={exposureDetails}/>)}
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
    let marketValueExists = actualMarketValue !== null && actualMarketValue !== undefined;
    const title = marketValueExists ? "Market Had A Value Of " + createUnit(actualMarketValue, unitDetails.tickDecimals, unitDetails) : (imHost ? "Set a market value for the game" : "Host has not yet set a market value")
    const supportText = !marketValueExists ? "Simulate A Value" : "Simulate Another Value"
    return <div style={{display: "flex", flexDirection: "row", width: "100%", flexWrap: "wrap"}}>
        <div style={{padding: 20, marginLeft: "auto", marginRight: "auto"}}>
            <TradeDialog style={{padding: 15, maxWidth: 350, marginTop: 20, marginRight: "auto", marginLeft: "auto"}}>
                <CardTitle>
                    <h3>{title}</h3>
                </CardTitle>
                <CardContent>
                    {
                        imHost && actualMarketValue === null ?
                            <div style={{display: "flex", flexDirection: "column"}}>
                                <TextField label={"Final market value"} type="number" value={inputtedMarketValue}
                                           sx={{m: 1, width: '25ch'}}
                                           InputProps={{
                                               startAdornment: <InputAdornment
                                                   style={{color: "rgba(255, 255, 255, 0.7)"}}
                                                   position="start">{unitDetails.unitPrefix}</InputAdornment>,
                                               endAdornment: <InputAdornment
                                                   position="start">{unitDetails.unitSuffix}</InputAdornment>,
                                           }}
                                           placeholder={actualMarketValue && actualMarketValue.toString()}
                                           onChange={(val) => setInputtedMarketValue(val.target.value)}/>
                                <Button onClick={() => {
                                    submitMarketValue(inputtedMarketValue)
                                }}> Submit </Button>
                            </div>
                            : <TextField label={supportText} type="number" value={inputtedMarketValue}
                                         sx={{m: 1, width: '25ch'}}
                                         InputProps={{
                                             startAdornment: <InputAdornment style={{color: "rgba(255, 255, 255, 0.7)"}}
                                                                             position="start">{unitDetails.unitPrefix}</InputAdornment>,
                                             endAdornment: <InputAdornment
                                                 position="start">{unitDetails.unitSuffix}</InputAdornment>,
                                         }}
                                         placeholder={actualMarketValue && actualMarketValue.toString()}
                                         onChange={(val) => setInputtedMarketValue(val.target.value)}/>
                    }

                </CardContent>
            </TradeDialog>
            <CardContent style={{display: "flex", flexDirection: "column", justifyContent: "center"}}>
                {marketValue === null ? <h2 style={{color: "white"}}>Simulate a market value to see
                    results</h2> : playerRows.map(makePlayerRow)}
            </CardContent></div>
        <TickBook {...{
            unitDetails,
            ticks,
            name,
            hoverPlayer,
            style: {flexBasis: 300, marginTop: 20, marginRight: "auto", marginLeft: "auto"},
            playerClear: () => {
                setHoverPlayer()
            }
        }} />
    </div>;
}

function coerceToPrice(number, tickSize, tickDecimals) {
    const closestMatch = Math.round(number / tickSize) * tickSize
    if (Math.abs((closestMatch - number) / tickSize) >= 0.1) {
        return [closestMatch, true];
    }
    return [Number(closestMatch.toFixed(tickDecimals)), false];
}

function getUrlFor(gameName) {
    return encodeURIComponent(gameName
        .replace(/[^\w\s]|_/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
        .replace(/[^0-9a-z\-]/gi, ''));
}

const loadingGif = '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="margin: auto; background: rgba(255, 255, 255, 0); display: inline; shape-rendering: auto;" width="40px" height="40px" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid">\n' +
    '<circle cx="50" cy="50" fill="none" stroke="#ffffff" stroke-width="10" r="35" stroke-dasharray="164.93361431346415 56.97787143782138">\n' +
    '  <animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="1s" values="0 50 50;360 50 50" keyTimes="0;1"></animateTransform>\n' +
    '</circle>\n' +
    '<!-- [ldio] generated by https://loading.io/ --></svg>'

// Don't know if this is neccesary


function InviteButton() {
    const [copied, setCopied] = useState(false);
    const textArea = useRef()
    return <div>
        <input ref={textArea}
               type="text" value={document.location.href}
               style={{
                   width: 200,
                   height: 30,
                   fontSize: 16,
                   borderRadius: 20,
                   color: themeOptions.palette.secondary.light,
                   background: "#424242",
                   border: 0
               }} readOnly/>,
        <IconButton color="primary" onClick={() => {
            setCopied(true)
            setTimeout(() => {
                setCopied(false)
            }, 1000)
            textArea.current.select()
            document.execCommand('copy')

        }}>
            {!copied ? <AssignmentIcon/> : <AssignmentTurnedInIcon/>}
        </IconButton></div>;
}

function MarketTitle({gameName}) {
    return <div style={{display: "flex", flexDirection: "row", alignContent: "center", flexWrap: "wrap"}}><IconButton
        color="primary" style={{marginLeft: "auto", marginRight: "auto"}} onClick={() => {
        document.location.href = "/"
    }}> <HomeIcon/>
    </IconButton><h2
        style={{color: themeOptions.palette.primary.main, marginTop: "auto", marginBottom: "auto"}}>marketmade.io -
        Market on {gameName}</h2></div>;
}

function TitleBar({onMarketEnd, expiryTimestamp, gameName}) {
    return <div style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        width: "inherit"
    }}><MarketTitle gameName={gameName}/>{expiryTimestamp !== undefined ?
        <MarketTimer onExpire={onMarketEnd} expiryTimestamp={expiryTimestamp}/> : undefined}<InviteButton/></div>;
}


const Market = (props) => {
    const {gameId} = useParams();
    const {replayData} = props;
    const [socket] = useState(() => io(`/ws`, {
//        transports: ['websocket'],
        withCredentials: true,
    }));

    const [error, setError] = useState('');
    const [info, setInfo] = useState('');

    // Game state
    const [name, setName] = useState();
    const [joiningName, setJoiningName] = useState('')
    const [joined, setJoined] = useState(false);
    const [imHost, setImHost] = useState(undefined);
    const [bids, setBids] = useState([])
    const [asks, setAsks] = useState([])
    const [marketOver, setMarketOver] = useState(undefined)
    const [myOutstandingOrders, setMyOutStandingOrders] = useState([])
    const [ticks, setTicks] = useState([])
    const [playerData, setPlayerData] = useState({})
    const [expiryTimestamp, setExpiryTimestamp] = useState()
    const [gameName, setGameName] = useState()
    const [gameMinutes, setGameMinutes] = useState()
    const [finalPlayerData, setFinalPlayerData] = useState()
    const [marketValue, setMarketValue] = useState()
    const [finalTicks, setFinalTicks] = useState()
    const [unitDetails, setUnitDetails] = useState({})
    const [exposureDetails, setExposureDetails] = useState()
    const [queuedJoinName, setQueuedJoinName] = useState()

    const sendEvent = (event, obj) => {
        const token = GetUUID()
        const requestWrapper = {token}
        socket.emit(event, Object.assign(requestWrapper, obj))
    }

    const stockData = useMemo(() => {
        const timeInterval = 60 * 1000;
        const intervals = []
        let currInterval = undefined;
        const roundTime = (time) => Math.ceil(time / timeInterval) * timeInterval
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
            x: timeWindow,
            y: [open, high, low, close]
        }));
        return data1
    }, [ticks])

    const marketEventHandlers = {
        'info': ({message}) => {
            setInfo(message)
        },
        'erroneousAction': ({message, errorDetails}) => {
            setError("There was an error performing that last task. " + message)
            if (errorDetails && errorDetails.redirectHome) {
                setTimeout(() => {
                    document.location.href = '/'
                }, 1500)
            }
        }, 'youJoined': (playerData, gameState) => {
            if (!joined) {
                setJoined(true);
                setGameState(gameState)
                setMyOutStandingOrders(
                    [...Object.values(playerData.outstandingBids), ...Object.values(playerData.outstandingAsks)]
                )
                setName(playerData.name)
            }
        },
        'gameStart': () => {
            document.location.reload();
        },
        'gameView': ({
                         gameName,
                         gameMinutes,
                         expiryTimestamp,
                         finalPlayerData,
                         finalTicks,
                         marketValue,
                         tickDecimals,
                         unitPrefix,
                         unitSuffix,
                         tickSize,
                         imHost,
                         yourName,
                         playerData,
                         yourPlayerData,
                         gameExposure,
                         exposureCurrency,
                     }) => {
            if (!replayData) {
                document.title = "Market - " + gameName
                let title = getUrlFor(gameName).substring(0, 30);
                window.history.replaceState(null, title, "/game/" + gameId + "/" + title)
            }
            setGameName(gameName)
            setImHost(imHost)
            setGameMinutes(gameMinutes)
            setExpiryTimestamp(expiryTimestamp)
            setMarketOver(isExpired(expiryTimestamp))
            setFinalPlayerData(finalPlayerData)
            setMarketValue(marketValue)
            setPlayerData((currentPlayerData) => ({...currentPlayerData, ...yourPlayerData, ...playerData}))
            setFinalTicks(finalTicks)
            setUnitDetails({unitSuffix, unitPrefix, tickSize: Number(tickSize), tickDecimals: Number(tickDecimals)})
            setExposureDetails({gameExposure, exposureCurrency})
            setQueuedJoinName(yourName)
        }, 'playerDataUpdate': (updatedPlayerData) => {
            setPlayerData((playerData) => {
                let playerDataCopy = {...playerData};
                playerDataCopy[updatedPlayerData.name] = updatedPlayerData;
                return playerDataCopy;
            })
        }, 'onTick': (newTick) => {
            setTicks((ticks) => {
                    return [...ticks, newTick]
                }
            )
        },
        'marketValueUpdate': (newMarketValue) => {
            setMarketValue(newMarketValue);
        }
    }

    let setGameState = ({
                            gameName,
                            gameMinutes,
                            gameId,
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
            bids,
            asks,
            ticks,
            playerData,
            tickSize
        })
        setBids(bids.reverse())
        setAsks(asks)
        setExpiryTimestamp(expiryTimestamp)
        setGameName(gameName)
        setGameMinutes(gameMinutes)
        setTicks(ticks)
        setPlayerData((oldPlayerData) => {
            let playerDataCopy = {...playerData, ...oldPlayerData};
            return playerDataCopy;
        })
    };
    const onJoinedHandlers = {
        'orderInsert': (order) => {
            const orderAddFunction = (orders) => {
                const newOrders = [...orders, order]
                newOrders.sort(orderSortFunction);
                return newOrders;
            }

            const publicOrderList = (order.isBid ? setBids : setAsks);
            if (order.name === name) {
                setMyOutStandingOrders(orderAddFunction)
            }
            publicOrderList(orderAddFunction)
        },
        'gameState': setGameState,
        'orderUpdate': (newOrder) => {
            // todo you were here, name doesn't get set.
            const orderAddFunction = ((orders) => {
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
        if (!joined) document.title = "Joining a market"

        if (replayData) {
            let i = 0
            marketEventHandlers['youJoined']({name: null, outstandingBids: {}, outstandingAsks: {}}, {
                "gameName": "Example Game",
                "gameMinutes": 5,
                "gameId": 0,
                "parties": [],
                "playerData": {},
                "bids": [],
                "asks": [],
                expiryTimestamp: 99999999999,
                "ticks": [],
                "transactionId": 1,
                "ackTimestamp": 1637721063820
            })
            setInterval(() => {
                if (i >= replayData.length) {
                    return;
                }
                const [event, data] = replayData[i]
                onJoinedHandlers[event]?.(data)
                marketEventHandlers[event]?.(data)
                i++
            }, 700)

            return;
        }
        socket.connect()

        Object.entries(marketEventHandlers)
            .forEach(([event, handler]) =>
                socket.on(event, handler))

        sendEvent('viewGame', {gameId});
    }, [])

    // Stuff that requires game state
    useEffect(() => {
        if (!joined || !name || replayData) {
            return;
        }
        Object.entries(onJoinedHandlers)
            .forEach(([event, handler]) =>
                socket.on(event, handler))

    }, [joined, name])
    const startGame = () => {
        return sendEvent("startGame");
    }
    const submitOrder = (price, volume, orderType) => {
        if (volume === 0) {
            return;
        }
        const [coercedPrice, tooFar] = coerceToPrice(price, unitDetails.tickSize, unitDetails.tickDecimals);
        if (tooFar) {
            setInfo("Order price has been coerced to tick size, submit new price?")
            setPrice(coercedPrice)
            return;
        }
        const isBid = volume > 0
        const order = {unsanitizedPrice: price, unsanitizedVolume: isBid ? volume : -volume, isBid, orderType};
        sendEvent('insertOrder', order);
    }

    const sendIoc = (price, volume) => {
        submitOrder(price, volume, "ioc")
    }

    const submitName = () => {
        sendEvent("joinGame", {name: getShortname(joiningName)});
    }

    const submitMarketValue = (marketValue) => {
        sendEvent("updateMarketValue", {marketValue})
    }

    const cancelOrderById = (orderId) => {
        sendEvent("cancelOrder", {orderId})
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
        submitOrder(Number(price) + unitDetails.tickSize, 1, "dime")
    }

    const placeDimeAsk = () => {
        const {price} = asks[0]
        submitOrder(Number(price) - unitDetails.tickSize, -1, "dime")
    }

    const pullOrders = () => {
        sendEvent("pullOrders")
    }

    // const exampleMarketData = [{date: new Date().getTime(), open: 3, high: 5, low: 2, close: 2},
    //     {date: new Date().getTime(), open: 3, high: 5, low: 2, close: 2}]

    const errorContainer = useRef(null)
    const halfMargin = 5;
    const onMarketEnd = () => {
        setMarketOver(true);
        sendEvent("viewGame")
    }
    const lrMargins = {marginLeft: halfMargin, marginRight: halfMargin}
    const tbPaddings = {paddingTop: halfMargin * 2, paddingBottom: halfMargin * 2}

    return <MuiThemeProvider theme={themeOptions}>
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
            {replayData ? null : <TitleBar {...{onMarketEnd, expiryTimestamp, gameName}}/>}
            {
                marketOver ? <MarketResults finalPlayerData={finalPlayerData}
                                            ticks={finalTicks}
                                            unitDetails={unitDetails}
                                            gameName={gameName}
                                            submitMarketValue={submitMarketValue}
                                            imHost={imHost}
                                            gameMinutes={gameMinutes}
                                            expiryTimestamp={expiryTimestamp}
                                            exposureDetails={exposureDetails}
                                            marketValue={marketValue}
                                            name={name}/> :
                    !replayData && !(joined && expiryTimestamp) ?
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
                            <h2 style={{marginBottom: 5}}>{`${gameName}`}</h2>
                            {expiryTimestamp !== undefined ?
                                <h4 style={{marginBottom: 10}}>{[<MarketTimer onExpire={onMarketEnd}
                                                                              expiryTimestamp={expiryTimestamp}
                                                                              fontSize={15}
                                                                              shortenText={true}/>, expiryTimestamp !== null ? `remaining of ${gameMinutes}m` : ""]}
                                </h4> : undefined
                            }
                            {exposureDetails ? <h4>
                                Exposure {exposureDetails.exposureCurrency + exposureDetails.gameExposure}
                            </h4> : undefined}
                            {exposureDetails ? <h4>
                                Duration {gameMinutes}m
                            </h4> : undefined}
                            <h4 style={{marginBottom: 25, marginTop: 10, alignSelf: "flex-start"}}> Current
                                players </h4>


                            <div style={{
                                display: "flex",
                                marginTop: 10,
                                flexWrap: "wrap",
                                justifyContent: "space-around",
                                alignItems: "center"
                            }}>
                                {Object.values(playerData).map(({name}) => (
                                    <PlayerChip name={name}/>
                                ))}
                            </div>
                            {!name ? <TextField value={joiningName} style={{marginTop: 30}}
                                                onChange={(val) => setJoiningName(val.target.value.toUpperCase())}
                                                label={`Full Name / Initials`}/> : undefined}
                            <div style={{
                                display: "flex",
                                flexDirection: "row",
                                alignItems: "center",
                                marginTop: 30
                            }}>

                                {name ?
                                    [imHost ? <Button onClick={() => startGame()}> Start Game </Button> : undefined,
                                        <div style={{marginLeft: "auto", marginRight: 10}}>✔️ Joining As️</div>,
                                        <PlayerChip name={queuedJoinName}/>]
                                    :
                                    [
                                        joiningName ?
                                            <>
                                                <Button style={{marginLeft: "auto"}} onClick={() => {
                                                    submitName();
                                                    setQueuedJoinName(joiningName)
                                                }}>
                                                    Join Market as
                                                </Button>
                                                <PlayerChip name={joiningName}/>
                                            </>
                                            : []]
                                }</div>


                        </TradeDialog>
                        :
                        [
                            <div style={{
                                width: "100%",
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                minHeight: 0,
                                height: "100%",
                                background: themeOptions.palette.background.default
                            }}>
                                <div style={{
                                    display: "flex",
                                    flexDirection: 'row',
                                    height: "100%",
                                    minHeight: 700,
                                    width: "100%",
                                    flexWrap: "wrap",
                                }}>
                                    <div style={{
                                        display: "flex",
                                        flex: 3,
                                        flexDirection: "column",
                                        minHeight: 350,
                                        height: "100%",
                                        flexBasis: "400px",
                                        ...lrMargins
                                    }}>
                                        <div style={{flex: 2, display: "block", width: "100%"}}>
                                            <div style={{height: "100%"}}>
                                                <Chart options={{
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
                                        <PlayerDataDiag style={{}} playerData={Object.values(playerData)} name={name}
                                                        unitDetails={unitDetails} exposureDetails={exposureDetails}/>
                                    </div>
                                    <div style={{
                                        display: "flex",
                                        flexDirection: 'column',
                                        flex: 2,
                                        height: "100%",
                                        flexBasis: 220,
                                        minHeight: 700,
                                        maxWidth: 500, ...lrMargins
                                    }}>
                                        <OrderBook {...{
                                            bids,
                                            asks,
                                            name,
                                            sendIoc,
                                            socket,
                                            cancelOrderById,
                                            unitDetails,
                                            placeDimeBid,
                                            placeDimeAsk,
                                            pullOrders,
                                            youHaveOutstandingOrders: myOutstandingOrders.length > 0,
                                            asksExist: asks.length > 0,
                                            bidsExist: bids.length > 0,
                                            style: {display: "flex", flexDirection: "column", flex: 1.5}
                                        }} setActivePrice={setPrice}/>
                                        <OrderWindow {...{
                                            unitDetails,
                                            price,
                                            setPrice,
                                            name,
                                            standingAskVol,
                                            standingBidVol,
                                            yourPlayerData,
                                            submitOrder,
                                            style: {
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                marginTop: halfMargin * 2
                                            }
                                        }} />
                                    </div>
                                    <TickBook ticks={ticks} name={name} style={{
                                        background: themeOptions.palette.secondary.dark,
                                        flex: 0.5,
                                        minHeight: 700,
                                        marginRight: "auto", marginLeft: "auto",
                                        flexBasis: 120, ...lrMargins
                                    }} unitDetails={unitDetails}/>
                                </div>
                            </div>
                        ]}
    </MuiThemeProvider>;
}


export default Market;