import './App.css';
import './colors'
import {ipAddress} from './network.js'
import {themeOptions} from "./colors";
import React, {useEffect, useState} from 'react';
import {Button, Card, MuiThemeProvider, TextField} from '@material-ui/core'
import {Route, Switch as RouteSwitch, useLocation, withRouter} from "react-router-dom";
import Market from "./Market";
import TextTransition from "react-text-transition";
import {Container, Jumbotron} from 'reactstrap';
import {transitions, positions, Provider as AlertProvider} from 'react-alert'
import AlertTemplate from 'react-alert-template-basic'
import {ExampleGameData1} from "./DemoGames";

let textSequence = 0;

function HomeScreen(props) {
    const [createGame, setCreateGame] = useState(false)
    const [gameName, setGameName] = useState("")

    const [gameMinutes, setGameMinutes] = useState(5)

    const [errorMessage, setErrorMessage] = useState("")
    const submitNewGame = () => {
        const requestOptions = {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({gameName, gameMinutes})
        };
        fetch(`http://${ipAddress}/api/game/`, requestOptions)
            .then(data => {
                    console.log(data)
                    if (data.status === 200) {
                        data.json().then(({gameId}) =>
                            props.history.push(`/game/${gameId}`)
                        )
                    } else if (data.status === 400) {
                        data.json().then(({errorMessage}) => setErrorMessage(errorMessage));
                    }
                }
            );
    }
    const [marketText, setMarketText] = useState('')
    const [titleText, setTitleText] = useState('')

    useEffect(() => {

        setInterval(() => {
            const marketTexts = ["windows in new york",
                "humans who have ever lived",
                "iPhones in the world",
                "elephant to lion weight ratio"]

            const interval = setMarketText(marketTexts[textSequence++ % marketTexts.length]);
            return () => {
                clearInterval(interval)
            }
        }, 3000)
        setTimeout(() => {
            setTitleText("Make a market on ")
        }, 1000)
    }, [])


    return <AlertProvider template={AlertTemplate}>
        <div style={{
            height: '100%',
            width: '100%',
            backgroundSize: 'contain',
            display: "flex",
            flexDirection: "row",
            background: "url(https://www.marketplace.org/wp-content/uploads/2021/10/stockmarket.jpg)",
            flexWrap: "wrap"
        }}>
            <div style={{display: "flex", flexDirection: "column", height: '100%', flex: 1, flexBasis: "400"}}>
                <Jumbotron style={{color: "white", width: '100%'}}>
                    <div style={{flex: 1, display: "flex", height: 100}}/>
                    <Container fluid style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        paddingLeft: 30
                    }}>
                        <h1 className="display-3" style={{width: "auto"}}><TextTransition style={{color: "white", marginRight:"0.25em"}}
                                                                                          inline
                                                                                          text={titleText}></TextTransition>
                            <TextTransition style={{color: "white"}} inline text={marketText}/>
                        </h1>
                        <p className="lead"></p>
                    </Container>
                </Jumbotron>
                <div style={{display: "flex", flex: 1}}/>
                {createGame ?
                    <Card style={{
                        display: "flex",
                        margin: "auto",
                        marginTop: 50,
                        flexDirection: "column",
                        flex: 1,
                        flexBasis: "200px",
                        maxWidth: "400px",
                        maxHeight: "380px",
                        minHeight: "200px",
                        width: "100%",
                        padding: 50
                    }}>
                        <h2 style={{margin: 10}}>Make a Market</h2>
                        <TextField value={gameName} onChange={(val) => setGameName(val.target.value)}
                                   label="Making a market on">
                            Test
                        </TextField>
                        <div style={{display: "flex", flexDirection: "row", alignContent: "center"}}>
                            <TextField value={gameMinutes} onChange={(val) => setGameMinutes(val.target.value)}
                                       type="number" style={{width: 200}} label="Market Ends after">
                            </TextField><label style={{marginTop: "auto"}}> minutes </label>
                        </div>
                        {errorMessage ?
                            <h3 style={{color: "red"}}>
                                Error: {errorMessage}
                            </h3> : []
                        }
                        <Button style={{marginTop: 30}} onClick={() => submitNewGame()}>
                            Create Game
                        </Button>
                    </Card>
                    :
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignSelf: "flex-start",
                        width: "400px",
                        justifyContent: "flex-start",
                        marginLeft: "50px",
                        marginTop: "50px",
                        marginRight: "auto"
                    }}>
                        <Button style={{color: "white", marginTop: "50px"}} variant="outlined" onClick={() => {
                            setCreateGame(true)
                        }}> Create A Market </Button>
                        <Button style={{color: "white", marginTop: "50px"}} variant="outlined"> Participate In A
                            Market </Button>
                    </div>
                }
                <div style={{height: createGame ? 30 : 300}}/>
            </div>
            <div style={{flex: 1, height: "100%"}}>
                <Market replayData={ExampleGameData1} />
            </div>
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
                overflowY: "scroll",
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
