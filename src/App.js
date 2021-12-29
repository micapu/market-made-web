import './App.css';
import './colors'
import {themeOptions} from "./colors";
import React, {useEffect, useRef, useState} from 'react';
import {Button, Card, CardContent, InputAdornment, MuiThemeProvider, Slide, TextField} from '@material-ui/core'
import {Route, Switch as RouteSwitch, useLocation, withRouter} from "react-router-dom";
import Market from "./Market";
import TextTransition from "react-text-transition";
import {CardTitle, Container, Jumbotron} from 'reactstrap';
import {Provider as AlertProvider} from 'react-alert'
import AlertTemplate from 'react-alert-template-basic'
import {ExampleGameData1} from "./DemoGames";
import GetUUID from "./GetUUID";

let textSequence = 0;


function HomeScreen(props) {
    const [createGame, setCreateGame] = useState(false)
    const [gameName, setGameName] = useState("")
    const [marketText, setMarketText] = useState('')
    const [titleText, setTitleText] = useState('')
    const [marketValue, setMarketValue] = useState('')
    const [gameMinutes, setGameMinutes] = useState(5)
    const [errorMessage, setErrorMessage] = useState("")
    const [showMore, setShowMore] = useState(false)
    const [unitPrefix, setUnitPrefix] = useState("$")
    const [unitSuffix, setUnitSuffix] = useState("")
    const [tickSize, setTickSize] = useState("0.1")
    const [gameExposure, setGameExposure] = useState("5")
    const [exposureCurrency, setExposureCurrency] = useState("€")
    const [exampleShow, setExampleShow] = useState(false)

    const marketRef = useRef()
    const submitNewGame = () => {
        const requestOptions = {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                gameName,
                gameMinutes,
                marketValue,
                tickSize,
                unitSuffix,
                unitPrefix,
                gameExposure,
                exposureCurrency,
                token: GetUUID()
            })
        };
        fetch(`/api/game/`, requestOptions)
            .then(data => {
                console.log(data)
                if (data.status === 200) {
                        data.json().then(({gameId}) =>
                            props.history.push(`/game/${gameId}`)
                        )
                    } else if (data.status === 400) {
                    data.json().then(({errorMessage}) => {
                        setErrorMessage(errorMessage)
                    });
                }
                }
            );
    }
    useEffect(() => {
        document.title = "Market? Made."
        setInterval(() => {
            const marketTexts = ["windows in new york",
                "humans who have ever lived",
                "iPhones in the world",
                "elephant to lion weight ratio"];

            // const marketTexts = ["windows in new york",
            //     "humans who have ever lived",
            //     "iPhones in the world",
            //     "elephant to lion weight ratio"]
            const interval = setMarketText(marketTexts[textSequence++ % marketTexts.length]);
            return () => {
                clearInterval(interval)
            }
        }, 3000)
        setTimeout(() => {
            setTitleText("Make a market on ")
        }, 1000)
    }, [])
    const container = useRef()
    const mainContentContainer = useRef()
    const marginTopTextFields = 5
    return <AlertProvider template={AlertTemplate}>
        <div style={{
            height: '100%',
            width: '100%',
            backgroundSize: 'contain',
            display: "flex",
            flexDirection: "row",
            background: "url(https://www.marketplace.org/wp-content/uploads/2021/10/stockmarket.jpg)",
            flexWrap: "wrap", overflowX: "hidden"
        }} ref={mainContentContainer}>
            <div style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                height: '100%',
                width: "100%",
                flexBasis: 330
            }}>
                <Jumbotron style={{color: "white", width: '100%', height: 200}}>
                    <div style={{flex: 1, display: "flex", height: 100}}/>
                    <Container fluid style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "flex-start",
                        marginLeft: "auto",
                        marginRight: "auto",
                    }}>
                        <h1 className="display-3" style={{
                            width: "auto",
                            marginLeft: 10,
                            marginRight: "auto",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "flex-start"
                        }}>
                            <TextTransition
                                style={{color: "white", marginRight: "0.25em", width: "100%", textAlign: "start"}}
                                inline
                                text={titleText}/>
                            <TextTransition style={{color: "white", width: "100%", textAlign: "start"}} inline
                                            text={marketText}/>
                        </h1>
                    </Container>
                </Jumbotron>
                <div style={{display: "flex", flex: 1, justifyContent: "center"}} ref={container}/>
                {createGame ?
                    <Slide direction="up" in={createGame} container={container.current}>
                        <Card style={{
                            display: "flex",
                            margin: "auto",
                            marginTop: 50,
                            flexDirection: "column",
                            padding: 40,
                        }}>
                            <CardTitle>
                                <h2>Make a Market</h2>
                            </CardTitle>
                            <CardContent style={{
                                display: "flex",
                                flexDirection: "column",
                                minHeight: "200px",
                                overflowY: "auto",
                            }}>
                                <TextField style={{marginTop: marginTopTextFields, minHeight: "3em"}} value={gameName}
                                           onChange={(val) => setGameName(val.target.value)}
                                           label="Market on"/>

                                <TextField style={{marginTop: marginTopTextFields, minHeight: "3em", flex: 1}}
                                           value={marketValue} type="number"
                                           onChange={(val) => setMarketValue(val.target.value)}
                                           sx={{m: 1, width: '25ch'}}
                                           InputProps={{
                                               startAdornment: <InputAdornment
                                                   position="start">{unitPrefix}</InputAdornment>,
                                               endAdornment: <InputAdornment
                                                   position="start">{unitSuffix}</InputAdornment>,
                                           }}
                                           label="Value of the market (Can be set at end)"/>

                                <div style={{
                                    display: "block",
                                    textAlign: "left",
                                    alignContent: "end",
                                    marginTop: marginTopTextFields,
                                    height: "max-content"

                                }}>
                                    <TextField value={exposureCurrency}
                                               onChange={(val) => setExposureCurrency(val.target.value.substr(0, 1))}
                                               type="text"
                                               style={{width: "3em", marginRight: 10, minHeight: "3em"}}
                                               label="Currency"/>

                                    <TextField value={gameExposure}

                                               onChange={(val) => setGameExposure(val.target.value)}
                                               type="number"
                                               sx={{m: 1, width: '25ch'}}
                                               InputProps={{
                                                   startAdornment: <InputAdornment
                                                       position="start">{exposureCurrency}</InputAdornment>,
                                               }}
                                               style={{width: 200, marginRight: 10, minHeight: "3em"}}
                                               label="Exposure"/>
                                    <TextField value={gameMinutes}

                                               onChange={(val) => setGameMinutes(val.target.value)}
                                               type="number" style={{width: 200, minHeight: "3em"}}
                                               label="Market Ends after"
                                               sx={{m: 1, width: '25ch'}}
                                               InputProps={{
                                                   endAdornment: <InputAdornment
                                                       position="end">minutes</InputAdornment>,
                                               }}/>
                                </div>
                                {showMore ?
                                    <div style={{
                                        display: "flex",
                                        minHeight: "3em",
                                        flexDirection: "row",
                                        marginTop: 10,
                                        width: "100%"
                                    }}>
                                        <TextField style={{marginRight: 5, minHeight: "3em"}} value={unitPrefix}
                                                   onChange={(val) => setUnitPrefix(val.target.value)}
                                                   label="Unit prefix"/>
                                        <TextField style={{marginRight: 5, minHeight: "3em"}} value={tickSize}
                                                   type="number"
                                                   onChange={(val) => setTickSize(val.target.value)}
                                                   label="Tick Size"/>
                                        <TextField style={{minHeight: "3em"}} value={unitSuffix}
                                                   placeholder={"i.e. x10^3"}
                                                   onChange={(val) => setUnitSuffix(val.target.value)}
                                                   label="Unit suffix"/>

                                    </div>
                                    : <Button style={{minHeight: "3em"}} onClick={() => setShowMore(true)}>
                                        Show More
                                    </Button>}

                                {errorMessage ?
                                    <h3 style={{color: themeOptions.palette.error}}>
                                        Error: {errorMessage}
                                    </h3> : []
                                }
                                <Button style={{marginTop: 20, marginBottom: 40, minHeight: "3em"}} color={"primary"}
                                        variant={"contained"}
                                        onClick={() => submitNewGame()}>
                                    Create Game
                                </Button>
                            </CardContent>
                        </Card>
                    </Slide>

                    :
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignSelf: "flex-start",
                        justifyContent: "flex-start",
                        flex: 1,
                        margin: "auto",
                        maxWidth: "400px",
                        marginTop: "50px",
                    }}>
                        <Button style={{color: "white", marginTop: "50px", minHeight: 35}} variant="contained"
                                color={"primary"}
                                onClick={() => {
                                    setCreateGame(true)
                                }}> Start A Market </Button>
                        {exampleShow ? undefined :
                            <Button style={{color: "white", marginTop: "50px", minHeight: 35}} variant="contained"
                                    color={"secondary"}
                                    onClick={() => {
                                        setExampleShow(true, () => marketRef.current.scrollIntoView({behavior: "smooth"})
                                        )
                                    }}> Show An Example Game </Button>}
                        <div style={{minHeight: 30}}/>
                    </div>
                }
            </div>
            <Slide direction="left" in={exampleShow} container={mainContentContainer.current}>
                {<div style={{flex: 3, height: "100%", display: exampleShow ? "flex" : "none"}}>
                    <div style={{flex: 1}} ref={marketRef} class={"conditional-padding"}> {exampleShow ? <Market
                        replayData={ExampleGameData1}/> : null} </div>
                </div>}
            </Slide>
        </div>
    </AlertProvider>
}

function App(props) {
    const location = useLocation();

    return (
        <MuiThemeProvider theme={themeOptions}>
            <div className="App" style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: (location.pathname.includes('/game') ? themeOptions.palette.background.default : "#060a0d")
            }}>
                {/*<h1 style={{color:themeOptions.palette.primary.main, marginTop:"20px"}}>*/}
                {/*    marketmade.io*/}
                {/*</h1>*/}
                <RouteSwitch>
                    <Route path="/game/:gameId" component={Market}/>
                    <Route component={HomeScreen}/>
                </RouteSwitch>
            </div>
        </MuiThemeProvider>
    );
}

export default withRouter(App);
